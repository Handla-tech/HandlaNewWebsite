import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { EmailService } from './email.service';
import {
  EMAIL_JOBS,
  MessageNotificationPayload,
  ResponseNotificationPayload,
  WelcomeEmailPayload,
  UserCreatedEmailPayload,
  ContractSentPayload,
  ContractSignedPayload,
  ContractRejectedPayload,
  InvoiceCreatedPayload,
  InvoiceOverduePayload,
  LeadAssignedPayload,
  LeadPromotedPayload,
  TaskAssignedPayload,
  TaskDelayedPayload,
} from './email.service';

/**
 * Bull processor for the 'email' queue.
 * Each @Process handler is invoked when a job of that name is dequeued.
 * Bull automatically handles the 3-attempt retry + exponential-backoff
 * defined in EMAIL_JOB_OPTIONS when the handler throws.
 */
@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  // ─── New Message Notification ─────────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_MESSAGE_NOTIFICATION)
  async handleMessageNotification(job: Job<MessageNotificationPayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_MESSAGE_NOTIFICATION}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );

    try {
      await this.emailService.sendMessageNotificationEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_MESSAGE_NOTIFICATION}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_MESSAGE_NOTIFICATION}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err; // Re-throw so Bull records the failure and retries
    }
  }

  // ─── Admin Response Notification ─────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_RESPONSE_NOTIFICATION)
  async handleResponseNotification(job: Job<ResponseNotificationPayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_RESPONSE_NOTIFICATION}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );

    try {
      await this.emailService.sendResponseNotificationEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_RESPONSE_NOTIFICATION}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_RESPONSE_NOTIFICATION}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─── Welcome Email ────────────────────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_WELCOME)
  async handleWelcomeEmail(job: Job<WelcomeEmailPayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_WELCOME}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );

    try {
      await this.emailService.sendWelcomeEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_WELCOME}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_WELCOME}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─── User-Created Email ───────────────────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_USER_CREATED)
  async handleUserCreatedEmail(job: Job<UserCreatedEmailPayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_USER_CREATED}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );

    try {
      await this.emailService.sendUserCreatedEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_USER_CREATED}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_USER_CREATED}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─── ERP-9: Contract Sent ─────────────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_CONTRACT_SENT)
  async handleContractSent(job: Job<ContractSentPayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_CONTRACT_SENT}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );
    try {
      await this.emailService.sendContractSentEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_CONTRACT_SENT}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_CONTRACT_SENT}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─── ERP-9: Contract Signed ───────────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_CONTRACT_SIGNED)
  async handleContractSigned(job: Job<ContractSignedPayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_CONTRACT_SIGNED}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );
    try {
      await this.emailService.sendContractSignedEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_CONTRACT_SIGNED}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_CONTRACT_SIGNED}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─── ERP-9: Contract Rejected ─────────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_CONTRACT_REJECTED)
  async handleContractRejected(job: Job<ContractRejectedPayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_CONTRACT_REJECTED}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );
    try {
      await this.emailService.sendContractRejectedEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_CONTRACT_REJECTED}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_CONTRACT_REJECTED}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─── ERP-9: Invoice Created ───────────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_INVOICE_CREATED)
  async handleInvoiceCreated(job: Job<InvoiceCreatedPayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_INVOICE_CREATED}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );
    try {
      await this.emailService.sendInvoiceCreatedEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_INVOICE_CREATED}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_INVOICE_CREATED}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─── ERP-9: Invoice Overdue ───────────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_INVOICE_OVERDUE)
  async handleInvoiceOverdue(job: Job<InvoiceOverduePayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_INVOICE_OVERDUE}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );
    try {
      await this.emailService.sendInvoiceOverdueEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_INVOICE_OVERDUE}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_INVOICE_OVERDUE}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─── ERP-9: Lead Assigned ─────────────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_LEAD_ASSIGNED)
  async handleLeadAssigned(job: Job<LeadAssignedPayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_LEAD_ASSIGNED}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );
    try {
      await this.emailService.sendLeadAssignedEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_LEAD_ASSIGNED}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_LEAD_ASSIGNED}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─── ERP-9: Lead Promoted ─────────────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_LEAD_PROMOTED)
  async handleLeadPromoted(job: Job<LeadPromotedPayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_LEAD_PROMOTED}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );
    try {
      await this.emailService.sendLeadPromotedEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_LEAD_PROMOTED}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_LEAD_PROMOTED}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─── ERP-9: Task Assigned ─────────────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_TASK_ASSIGNED)
  async handleTaskAssigned(job: Job<TaskAssignedPayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_TASK_ASSIGNED}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );
    try {
      await this.emailService.sendTaskAssignedEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_TASK_ASSIGNED}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_TASK_ASSIGNED}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─── ERP-9: Task Delayed ──────────────────────────────────────────────────

  @Process(EMAIL_JOBS.SEND_TASK_DELAYED)
  async handleTaskDelayed(job: Job<TaskDelayedPayload>): Promise<void> {
    const { id, data, attemptsMade } = job;
    this.logger.log(
      `Processing job ${id} [${EMAIL_JOBS.SEND_TASK_DELAYED}] ` +
        `attempt ${attemptsMade + 1} → ${data.recipientEmail}`,
    );
    try {
      await this.emailService.sendTaskDelayedEmail(data);
      this.logger.log(`Job ${id} [${EMAIL_JOBS.SEND_TASK_DELAYED}] completed ✓`);
    } catch (err) {
      this.logger.error(
        `Job ${id} [${EMAIL_JOBS.SEND_TASK_DELAYED}] failed ` +
          `(attempt ${attemptsMade + 1}): ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }
}
