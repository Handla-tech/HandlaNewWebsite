import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';

/**
 * ERP-7 — InvoicesScheduler
 *
 * Scheduled job: runs recalculateOverdueStatus() every day at 1:00am.
 *
 * Design decision (mirrors ERP-5 TasksScheduler):
 *   @nestjs/schedule is NOT in package.json.  To avoid adding a new library
 *   dependency (GROUND RULES: "No new libraries") we use Node.js built-in
 *   setTimeout / setInterval.
 *
 *   1. On app bootstrap, calculate ms until the next 01:00 local time.
 *   2. setTimeout fires the first run; then setInterval repeats every 24h.
 *
 * Error handling:
 *   Errors are caught and logged — the scheduler must never crash or stop
 *   future runs on a single failure.
 */
@Injectable()
export class InvoicesScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(InvoicesScheduler.name);
  private initialTimer: NodeJS.Timeout | null = null;
  private recurringInterval: NodeJS.Timeout | null = null;

  constructor(private readonly invoicesService: InvoicesService) {}

  onApplicationBootstrap(): void {
    this.scheduleDailyJob();
  }

  onApplicationShutdown(): void {
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.recurringInterval) clearInterval(this.recurringInterval);
    this.logger.log('InvoicesScheduler shutdown — timers cleared');
  }

  private scheduleDailyJob(): void {
    const msUntil1am = this.getMsUntil1am();
    this.logger.log(
      `InvoicesScheduler: first run in ${Math.round(msUntil1am / 1000 / 60)} min (at next 1am)`,
    );

    this.initialTimer = setTimeout(() => {
      void this.runJob();
      const msIn24h = 24 * 60 * 60 * 1000;
      this.recurringInterval = setInterval(() => void this.runJob(), msIn24h);
    }, msUntil1am);
  }

  private async runJob(): Promise<void> {
    this.logger.log('InvoicesScheduler: starting overdue recalculation');
    try {
      const count = await this.invoicesService.recalculateOverdueStatus();
      this.logger.log(`InvoicesScheduler: ${count} invoice(s) marked OVERDUE`);
    } catch (err) {
      this.logger.error(
        'InvoicesScheduler: recalculateOverdueStatus failed',
        (err as Error).stack,
      );
    }
  }

  /** Returns milliseconds from now until next 01:00 local time. */
  private getMsUntil1am(): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(1, 0, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime() - now.getTime();
  }
}
