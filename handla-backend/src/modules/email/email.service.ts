import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

// ─── Job Payload Interfaces ──────────────────────────────────────────────────

export interface MessageNotificationPayload {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  messagePreview: string;
  conversationId: string;
  dashboardUrl: string;
}

export interface ResponseNotificationPayload {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  messagePreview: string;
  conversationId: string;
  dashboardUrl: string;
}

export interface WelcomeEmailPayload {
  recipientEmail: string;
  userName: string;
  dashboardUrl: string;
}

export interface UserCreatedEmailPayload {
  recipientEmail: string;
  userName: string;
  temporaryPassword: string;
  dashboardUrl: string;
}

// ─── ERP-9 Job Payload Interfaces ────────────────────────────────────────────

export interface ContractSentPayload {
  recipientEmail: string;
  recipientName: string;
  contractTitle: string;
  contractId: string;
  erpUrl: string;
}

export interface ContractSignedPayload {
  recipientEmail: string;
  recipientName: string;
  contractTitle: string;
  contractId: string;
  erpUrl: string;
}

export interface ContractRejectedPayload {
  recipientEmail: string;
  recipientName: string;
  contractTitle: string;
  contractId: string;
  erpUrl: string;
}

export interface InvoiceCreatedPayload {
  recipientEmail: string;
  recipientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string | null;
  erpUrl: string;
}

export interface InvoiceOverduePayload {
  recipientEmail: string;
  recipientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string | null;
  erpUrl: string;
}

export interface LeadAssignedPayload {
  recipientEmail: string;
  recipientName: string;
  clientName: string;
  clientId: string;
  erpUrl: string;
}

export interface LeadPromotedPayload {
  recipientEmail: string;
  recipientName: string;
  clientName: string;
  clientId: string;
  erpUrl: string;
}

export interface TaskAssignedPayload {
  recipientEmail: string;
  recipientName: string;
  taskTitle: string;
  taskId: string;
  dueDate: string | null;
  erpUrl: string;
}

export interface TaskDelayedPayload {
  recipientEmail: string;
  recipientName: string;
  taskTitle: string;
  taskId: string;
  dueDate: string | null;
  erpUrl: string;
}

// ─── Email Job Types ─────────────────────────────────────────────────────────

export const EMAIL_JOBS = {
  SEND_MESSAGE_NOTIFICATION:  'send-message-notification',
  SEND_RESPONSE_NOTIFICATION: 'send-response-notification',
  SEND_WELCOME:               'send-welcome',
  SEND_USER_CREATED:          'send-user-created',
  // ERP-9
  SEND_CONTRACT_SENT:     'send-contract-sent',
  SEND_CONTRACT_SIGNED:   'send-contract-signed',
  SEND_CONTRACT_REJECTED: 'send-contract-rejected',
  SEND_INVOICE_CREATED:   'send-invoice-created',
  SEND_INVOICE_OVERDUE:   'send-invoice-overdue',
  SEND_LEAD_ASSIGNED:     'send-lead-assigned',
  SEND_LEAD_PROMOTED:     'send-lead-promoted',
  SEND_TASK_ASSIGNED:     'send-task-assigned',
  SEND_TASK_DELAYED:      'send-task-delayed',
} as const;

// ─── Bull job options (3-attempt retry with exponential backoff) ─────────────

export const EMAIL_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly templateCache = new Map<string, handlebars.TemplateDelegate>();

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {
    // Build Nodemailer transporter from config
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('email.host'),
      port: this.configService.get<number>('email.port'),
      secure: this.configService.get<boolean>('email.secure'),
      auth: {
        user: this.configService.get<string>('email.user'),
        pass: this.configService.get<string>('email.pass'),
      },
    });

    this.from = this.configService.get<string>('email.from') || 'no-reply@handla.com';
  }

  // ─── Computed Properties ─────────────────────────────────────────────────────
  private get baseUrl(): string {
    return this.configService.get<string>('BASE_URL') || 'https://handla.com';
  }

  // ─── Queue Methods ───────────────────────────────────────────────────────────

  /** Queue a "new message" email notification (async, 3-attempt retry) */
  async queueMessageNotification(payload: MessageNotificationPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_MESSAGE_NOTIFICATION, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued message-notification email → ${payload.recipientEmail}`);
  }

  /** Queue a "new admin response" email notification (async, 3-attempt retry) */
  async queueResponseNotification(payload: ResponseNotificationPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_RESPONSE_NOTIFICATION, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued response-notification email → ${payload.recipientEmail}`);
  }

  /** Queue a user-created email (async, 3-attempt retry) — fired when ADMIN creates a user */
  async queueUserCreatedEmail(payload: UserCreatedEmailPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_USER_CREATED, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued user-created email → ${payload.recipientEmail}`);
  }

  /** Queue a welcome email (async, 3-attempt retry) */
  async queueWelcomeEmail(payload: WelcomeEmailPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_WELCOME, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued welcome email → ${payload.recipientEmail}`);
  }

  // ─── ERP-9 Queue Methods ─────────────────────────────────────────────────────

  async queueContractSent(payload: ContractSentPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_CONTRACT_SENT, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued contract-sent email → ${payload.recipientEmail}`);
  }

  async queueContractSigned(payload: ContractSignedPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_CONTRACT_SIGNED, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued contract-signed email → ${payload.recipientEmail}`);
  }

  async queueContractRejected(payload: ContractRejectedPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_CONTRACT_REJECTED, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued contract-rejected email → ${payload.recipientEmail}`);
  }

  async queueInvoiceCreated(payload: InvoiceCreatedPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_INVOICE_CREATED, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued invoice-created email → ${payload.recipientEmail}`);
  }

  async queueInvoiceOverdue(payload: InvoiceOverduePayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_INVOICE_OVERDUE, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued invoice-overdue email → ${payload.recipientEmail}`);
  }

  async queueLeadAssigned(payload: LeadAssignedPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_LEAD_ASSIGNED, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued lead-assigned email → ${payload.recipientEmail}`);
  }

  async queueLeadPromoted(payload: LeadPromotedPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_LEAD_PROMOTED, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued lead-promoted email → ${payload.recipientEmail}`);
  }

  async queueTaskAssigned(payload: TaskAssignedPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_TASK_ASSIGNED, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued task-assigned email → ${payload.recipientEmail}`);
  }

  async queueTaskDelayed(payload: TaskDelayedPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_TASK_DELAYED, payload, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued task-delayed email → ${payload.recipientEmail}`);
  }

  // ─── Direct Send Methods (called by EmailProcessor) ──────────────────────────

  /** Render message-notification template and send via SMTP */
  async sendMessageNotificationEmail(payload: MessageNotificationPayload): Promise<void> {
    const html = await this.renderTemplate('message-notification', {
      recipientName: payload.recipientName,
      senderName: payload.senderName,
      messagePreview: payload.messagePreview,
      dashboardUrl: payload.dashboardUrl,
      timestamp: new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      baseUrl: this.baseUrl,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: payload.recipientEmail,
      subject: `💬 New message from ${payload.senderName} — Handla`,
      html,
    });
  }

  /** Render response-notification template and send via SMTP */
  async sendResponseNotificationEmail(payload: ResponseNotificationPayload): Promise<void> {
    const html = await this.renderTemplate('response-notification', {
      recipientName: payload.recipientName,
      senderName: payload.senderName,
      messagePreview: payload.messagePreview,
      dashboardUrl: payload.dashboardUrl,
      timestamp: new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      baseUrl: this.baseUrl,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: payload.recipientEmail,
      subject: `✅ New response on your request — Handla`,
      html,
    });
  }

  /** Render user-created template and send via SMTP */
  async sendUserCreatedEmail(payload: UserCreatedEmailPayload): Promise<void> {
    const html = await this.renderTemplate('user-created', {
      userName: payload.userName,
      temporaryPassword: payload.temporaryPassword,
      recipientEmail: payload.recipientEmail, // ← needed by {{recipientEmail}} in template
      dashboardUrl: payload.dashboardUrl,
      baseUrl: this.baseUrl,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: payload.recipientEmail,
      subject: `🎉 Your Handla account is ready — ${payload.userName}`,
      html,
    });
  }

  /** Render welcome template and send via SMTP */
  async sendWelcomeEmail(payload: WelcomeEmailPayload): Promise<void> {
    const html = await this.renderTemplate('welcome', {
      userName: payload.userName,
      dashboardUrl: payload.dashboardUrl,
      baseUrl: this.baseUrl,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: payload.recipientEmail,
      subject: `👋 Welcome to Handla!`,
      html,
    });
  }

  // ─── Core Send Helper ────────────────────────────────────────────────────────

  // ─── ERP-9 Direct Send Methods ───────────────────────────────────────────────

  async sendContractSentEmail(payload: ContractSentPayload): Promise<void> {
    const html = await this.renderTemplate('contract-sent', {
      recipientName: payload.recipientName,
      contractTitle: payload.contractTitle,
      contractId:    payload.contractId,
      erpUrl:        payload.erpUrl,
      baseUrl:       this.baseUrl,
      year:          new Date().getFullYear(),
    });
    await this.sendMail({
      to:      payload.recipientEmail,
      subject: `📄 Contract for Review: ${payload.contractTitle} — Handla`,
      html,
    });
  }

  async sendContractSignedEmail(payload: ContractSignedPayload): Promise<void> {
    const html = await this.renderTemplate('contract-signed', {
      recipientName: payload.recipientName,
      contractTitle: payload.contractTitle,
      contractId:    payload.contractId,
      erpUrl:        payload.erpUrl,
      baseUrl:       this.baseUrl,
      year:          new Date().getFullYear(),
    });
    await this.sendMail({
      to:      payload.recipientEmail,
      subject: `✅ Contract Signed: ${payload.contractTitle} — Handla`,
      html,
    });
  }

  async sendContractRejectedEmail(payload: ContractRejectedPayload): Promise<void> {
    const html = await this.renderTemplate('contract-rejected', {
      recipientName: payload.recipientName,
      contractTitle: payload.contractTitle,
      contractId:    payload.contractId,
      erpUrl:        payload.erpUrl,
      baseUrl:       this.baseUrl,
      year:          new Date().getFullYear(),
    });
    await this.sendMail({
      to:      payload.recipientEmail,
      subject: `❌ Contract Rejected: ${payload.contractTitle} — Handla`,
      html,
    });
  }

  async sendInvoiceCreatedEmail(payload: InvoiceCreatedPayload): Promise<void> {
    const html = await this.renderTemplate('invoice-created', {
      recipientName:  payload.recipientName,
      invoiceNumber:  payload.invoiceNumber,
      amount:         payload.amount,
      dueDate:        payload.dueDate ?? 'No due date',
      erpUrl:         payload.erpUrl,
      baseUrl:        this.baseUrl,
      year:           new Date().getFullYear(),
    });
    await this.sendMail({
      to:      payload.recipientEmail,
      subject: `🧾 New Invoice ${payload.invoiceNumber} — Handla`,
      html,
    });
  }

  async sendInvoiceOverdueEmail(payload: InvoiceOverduePayload): Promise<void> {
    const html = await this.renderTemplate('invoice-overdue', {
      recipientName:  payload.recipientName,
      invoiceNumber:  payload.invoiceNumber,
      amount:         payload.amount,
      dueDate:        payload.dueDate ?? 'Past due',
      erpUrl:         payload.erpUrl,
      baseUrl:        this.baseUrl,
      year:           new Date().getFullYear(),
    });
    await this.sendMail({
      to:      payload.recipientEmail,
      subject: `⚠️ Invoice ${payload.invoiceNumber} is Overdue — Handla`,
      html,
    });
  }

  async sendLeadAssignedEmail(payload: LeadAssignedPayload): Promise<void> {
    const html = await this.renderTemplate('lead-assigned', {
      recipientName: payload.recipientName,
      clientName:    payload.clientName,
      clientId:      payload.clientId,
      erpUrl:        payload.erpUrl,
      baseUrl:       this.baseUrl,
      year:          new Date().getFullYear(),
    });
    await this.sendMail({
      to:      payload.recipientEmail,
      subject: `👤 New Client Assigned: ${payload.clientName} — Handla`,
      html,
    });
  }

  async sendLeadPromotedEmail(payload: LeadPromotedPayload): Promise<void> {
    const html = await this.renderTemplate('lead-promoted', {
      recipientName: payload.recipientName,
      clientName:    payload.clientName,
      clientId:      payload.clientId,
      erpUrl:        payload.erpUrl,
      baseUrl:       this.baseUrl,
      year:          new Date().getFullYear(),
    });
    await this.sendMail({
      to:      payload.recipientEmail,
      subject: `🎉 Lead Promoted to Client: ${payload.clientName} — Handla`,
      html,
    });
  }

  async sendTaskAssignedEmail(payload: TaskAssignedPayload): Promise<void> {
    const html = await this.renderTemplate('task-assigned', {
      recipientName: payload.recipientName,
      taskTitle:     payload.taskTitle,
      taskId:        payload.taskId,
      dueDate:       payload.dueDate ?? 'No due date',
      erpUrl:        payload.erpUrl,
      baseUrl:       this.baseUrl,
      year:          new Date().getFullYear(),
    });
    await this.sendMail({
      to:      payload.recipientEmail,
      subject: `📋 New Task Assigned: ${payload.taskTitle} — Handla`,
      html,
    });
  }

  async sendTaskDelayedEmail(payload: TaskDelayedPayload): Promise<void> {
    const html = await this.renderTemplate('task-delayed', {
      recipientName: payload.recipientName,
      taskTitle:     payload.taskTitle,
      taskId:        payload.taskId,
      dueDate:       payload.dueDate ?? 'Past due',
      erpUrl:        payload.erpUrl,
      baseUrl:       this.baseUrl,
      year:          new Date().getFullYear(),
    });
    await this.sendMail({
      to:      payload.recipientEmail,
      subject: `⏰ Task Overdue: ${payload.taskTitle} — Handla`,
      html,
    });
  }

  async sendMail(options: {    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      this.logger.log(`Email sent to ${options.to} — messageId: ${info.messageId}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}: ${err.message}`, err.stack);
      throw err; // re-throw so Bull can retry
    }
  }

  // ─── Template Renderer ────────────────────────────────────────────────────────

  /**
   * Compile and cache a Handlebars template, then render it with the given context.
   * Templates live in `src/modules/email/templates/{name}.hbs`.
   */
  async renderTemplate(name: string, context: Record<string, unknown>): Promise<string> {
    if (!this.templateCache.has(name)) {
      const templatePath = path.join(__dirname, 'templates', `${name}.hbs`);

      let source: string;
      try {
        source = fs.readFileSync(templatePath, 'utf8');
      } catch (err) {
        // During tests the compiled path differs; fall back to src path
        const srcPath = path.join(
          process.cwd(),
          'src',
          'modules',
          'email',
          'templates',
          `${name}.hbs`,
        );
        source = fs.readFileSync(srcPath, 'utf8');
      }

      this.templateCache.set(name, handlebars.compile(source));
    }

    const template = this.templateCache.get(name)!;
    return template(context);
  }
}
