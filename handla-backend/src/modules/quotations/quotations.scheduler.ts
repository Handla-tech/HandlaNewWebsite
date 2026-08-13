import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { QuotationsService } from './quotations.service';

/**
 * QUO-2 — QuotationsScheduler
 *
 * Scheduled job: runs recalculateExpiredStatus() every day at 3:00am
 * (SENT quotations whose validUntil date has passed become EXPIRED).
 *
 * Mirrors InvoicesScheduler / PurchasesScheduler: uses Node.js built-in
 * setTimeout / setInterval (GROUND RULE: no @nestjs/schedule dependency).
 * Errors are caught and logged so a single failure never stops future runs.
 */
@Injectable()
export class QuotationsScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(QuotationsScheduler.name);
  private initialTimer: NodeJS.Timeout | null = null;
  private recurringInterval: NodeJS.Timeout | null = null;

  constructor(private readonly quotationsService: QuotationsService) {}

  onApplicationBootstrap(): void {
    this.scheduleDailyJob();
  }

  onApplicationShutdown(): void {
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.recurringInterval) clearInterval(this.recurringInterval);
    this.logger.log('QuotationsScheduler shutdown — timers cleared');
  }

  private scheduleDailyJob(): void {
    const msUntil3am = this.getMsUntil3am();
    this.logger.log(
      `QuotationsScheduler: first run in ${Math.round(msUntil3am / 1000 / 60)} min (at next 3am)`,
    );

    this.initialTimer = setTimeout(() => {
      void this.runJob();
      const msIn24h = 24 * 60 * 60 * 1000;
      this.recurringInterval = setInterval(() => void this.runJob(), msIn24h);
    }, msUntil3am);
  }

  private async runJob(): Promise<void> {
    this.logger.log('QuotationsScheduler: starting expiry recalculation');
    try {
      const count = await this.quotationsService.recalculateExpiredStatus();
      this.logger.log(`QuotationsScheduler: ${count} quotation(s) marked EXPIRED`);
    } catch (err) {
      this.logger.error(
        'QuotationsScheduler: recalculateExpiredStatus failed',
        (err as Error).stack,
      );
    }
  }

  /** Returns milliseconds from now until next 03:00 local time. */
  private getMsUntil3am(): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(3, 0, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime() - now.getTime();
  }
}
