import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushToken } from './entities/push-token.entity';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface RegisterPushTokenInput {
  token: string;
  platform?: string | null;
  deviceName?: string | null;
}

interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

/**
 * Manages device push tokens and delivers notifications to Expo's Push API.
 *
 * Uses the global `fetch` (Node 18+) so no extra HTTP dependency is needed.
 * Invalid Expo tokens (DeviceNotRegistered) are pruned automatically.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(PushToken)
    private readonly pushTokenRepo: Repository<PushToken>,
  ) {}

  /** Basic sanity check for an Expo push token. */
  private isExpoToken(token: string): boolean {
    return (
      typeof token === 'string' &&
      (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
    );
  }

  /**
   * Register (upsert) a device token for a user. If the token already exists
   * (same device), it is re-assigned to this user and metadata refreshed.
   */
  async registerToken(userId: string, input: RegisterPushTokenInput): Promise<PushToken> {
    const { token, platform, deviceName } = input;

    let row = await this.pushTokenRepo.findOne({ where: { token } });
    if (row) {
      row.userId = userId;
      row.platform = platform ?? row.platform ?? null;
      row.deviceName = deviceName ?? row.deviceName ?? null;
    } else {
      row = this.pushTokenRepo.create({
        userId,
        token,
        platform: platform ?? null,
        deviceName: deviceName ?? null,
      });
    }
    const saved = await this.pushTokenRepo.save(row);
    this.logger.log(`Push token registered → user=${userId} platform=${platform ?? '?'}`);
    return saved;
  }

  /** Remove a device token (e.g. on sign-out or when the user disables push). */
  async unregisterToken(userId: string, token: string): Promise<{ deleted: number }> {
    const res = await this.pushTokenRepo.delete({ userId, token });
    return { deleted: res.affected ?? 0 };
  }

  /** All tokens for a given user (a user may have several devices). */
  async getUserTokens(userId: string): Promise<PushToken[]> {
    return this.pushTokenRepo.find({ where: { userId } });
  }

  /**
   * Send a push notification to every device registered for `userId`.
   * Best-effort: failures are logged, never thrown, so notification creation
   * is never blocked by a push delivery problem.
   */
  async sendToUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, unknown>; badge?: number },
  ): Promise<void> {
    try {
      const tokens = await this.getUserTokens(userId);
      if (tokens.length === 0) return;

      const messages: ExpoPushMessage[] = tokens
        .filter((t) => this.isExpoToken(t.token))
        .map((t) => ({
          to: t.token,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
          sound: 'default',
          badge: payload.badge,
          channelId: 'default',
        }));

      if (messages.length === 0) return;

      await this.sendExpoMessages(messages, tokens);
    } catch (err) {
      this.logger.error(
        `Failed sending push to user=${userId}: ${(err as Error).message}`,
      );
    }
  }

  /** POST the batch to Expo and prune tokens Expo reports as unregistered. */
  private async sendExpoMessages(messages: ExpoPushMessage[], tokens: PushToken[]): Promise<void> {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      this.logger.warn(`Expo push responded ${res.status}`);
      return;
    }

    const json = (await res.json()) as {
      data?: Array<{ status: string; message?: string; details?: { error?: string } }>;
    };

    const tickets = json.data ?? [];
    // Prune tokens that Expo says are no longer valid.
    const toPrune: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const tok = messages[i]?.to;
        if (tok) toPrune.push(tok);
      }
    });

    if (toPrune.length > 0) {
      await this.pushTokenRepo.delete(toPrune.map((token) => ({ token })));
      this.logger.log(`Pruned ${toPrune.length} unregistered push token(s)`);
    }
    void tokens;
  }
}
