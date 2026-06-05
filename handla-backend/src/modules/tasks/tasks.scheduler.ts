import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { TasksService } from './tasks.service';

/**
 * ERP-5 — TasksScheduler
 *
 * Scheduled job: runs recalculateDelayedStatus() every day at midnight (00:00 local time).
 *
 * Design decision:
 *   @nestjs/schedule is NOT in package.json, so we cannot use @Cron() decorator.
 *   To avoid adding a new library dependency (per GROUND RULES: "No new libraries"),
 *   we implement the daily scheduler using Node.js built-in setInterval / setTimeout.
 *
 *   Approach:
 *     1. On app bootstrap, calculate the milliseconds until the next midnight.
 *     2. Schedule a setTimeout for that duration; on trigger, fire the job and then
 *        set a 24-hour setInterval for all subsequent executions.
 *
 *   This is equivalent to @Cron('0 0 * * *') without the @nestjs/schedule dependency.
 *
 * Error handling:
 *   Errors from recalculateDelayedStatus() are caught and logged — the scheduler
 *   must not crash or stop future runs on a single failure.
 */
@Injectable()
export class TasksScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TasksScheduler.name);
  private initialTimer: NodeJS.Timeout | null = null;
  private recurringInterval: NodeJS.Timeout | null = null;

  constructor(private readonly tasksService: TasksService) {}

  onApplicationBootstrap(): void {
    this.scheduleDailyJob();
  }

  onApplicationShutdown(): void {
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.recurringInterval) clearInterval(this.recurringInterval);
    this.logger.log('TasksScheduler shutdown — timers cleared');
  }

  private scheduleDailyJob(): void {
    const msUntilMidnight = this.getMsUntilMidnight();
    this.logger.log(
      `TasksScheduler: first run in ${Math.round(msUntilMidnight / 1000 / 60)} minutes (at next midnight)`,
    );

    this.initialTimer = setTimeout(() => {
      void this.runJob();
      // After the first midnight trigger, run every 24 hours
      const msIn24h = 24 * 60 * 60 * 1000;
      this.recurringInterval = setInterval(() => void this.runJob(), msIn24h);
    }, msUntilMidnight);
  }

  private async runJob(): Promise<void> {
    this.logger.log('TasksScheduler: starting daily delayed-status recalculation');
    try {
      const count = await this.tasksService.recalculateDelayedStatus();
      this.logger.log(`TasksScheduler: recalculation complete — ${count} task(s) marked DELAYED`);
    } catch (err) {
      this.logger.error('TasksScheduler: recalculateDelayedStatus failed', (err as Error).stack);
    }
  }

  /** Returns milliseconds from now until the next midnight (00:00:00). */
  private getMsUntilMidnight(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime() - now.getTime();
  }
}
