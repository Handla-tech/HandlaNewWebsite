import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';

/**
 * PUR-1 — PurchasesScheduler
 *
 * Mirrors InvoicesScheduler but runs at 02:00 (invoices run at 01:00) to flip
 * overdue UNPAID purchases. Uses built-in setTimeout/setInterval (no new libs).
 */
@Injectable()
export class PurchasesScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PurchasesScheduler.name);
  private initialTimer: NodeJS.Timeout | null = null;
  private recurringInterval: NodeJS.Timeout | null = null;

  constructor(private readonly purchasesService: PurchasesService) {}

  onApplicationBootstrap(): void {
    this.scheduleDailyJob();
  }

  onApplicationShutdown(): void {
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.recurringInterval) clearInterval(this.recurringInterval);
    this.logger.log('PurchasesScheduler shutdown — timers cleared');
  }

  private scheduleDailyJob(): void {
    const msUntil2am = this.getMsUntil2am();
    this.logger.log(
      `PurchasesScheduler: first run in ${Math.round(msUntil2am / 1000 / 60)} min (at next 2am)`,
    );
    this.initialTimer = setTimeout(() => {
      void this.runJob();
      const msIn24h = 24 * 60 * 60 * 1000;
      this.recurringInterval = setInterval(() => void this.runJob(), msIn24h);
    }, msUntil2am);
  }

  private async runJob(): Promise<void> {
    this.logger.log('PurchasesScheduler: starting overdue recalculation');
    try {
      const count = await this.purchasesService.recalculateOverdueStatus();
      this.logger.log(`PurchasesScheduler: ${count} purchase(s) marked OVERDUE`);
    } catch (err) {
      this.logger.error(
        'PurchasesScheduler: recalculateOverdueStatus failed',
        (err as Error).stack,
      );
    }
  }

  private getMsUntil2am(): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(2, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }
}
