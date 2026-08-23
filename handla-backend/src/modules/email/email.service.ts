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

export interface VerificationCodeEmailPayload {
  recipientEmail: string;
  /** Best-effort display name; falls back to a generic greeting when absent. */
  recipientName?: string | null;
  /** The plaintext 6-digit code — used ONLY to render the email, never stored. */
  code: string;
  /** Minutes until the code expires (for the "expires in N minutes" line). */
  expiresInMinutes: number;
  /** Why the code was sent — tunes the wording. */
  purpose: 'signup' | 'login' | 'google' | 'reset';
  /** 'ar' | 'en' — locale-aware content. Defaults to 'en'. */
  locale?: string;
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
  private readonly replyTo: string;
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

    // Prefer the composed `"Display Name" <address>` header so client mailboxes
    // show a friendly sender; fall back to the bare address.
    this.from =
      this.configService.get<string>('email.fromHeader') ||
      this.configService.get<string>('email.from') ||
      'no-reply@handla.com';
    // Where replies should go (e.g. support@handla.com) — falls back to `from`.
    this.replyTo =
      this.configService.get<string>('email.replyTo') ||
      this.configService.get<string>('email.from') ||
      'no-reply@handla.com';
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

  /**
   * Render + send a verification/OTP email DIRECTLY (not queued).
   *
   * The user is actively waiting on the OTP screen, so this must not depend on
   * the Redis/Bull worker being up. The plaintext code is used only to render
   * the HTML here and is never logged or persisted by this method.
   */
  async sendVerificationCodeEmail(payload: VerificationCodeEmailPayload): Promise<void> {
    const isAr = (payload.locale || 'en').toLowerCase().startsWith('ar');
    const name = payload.recipientName?.trim();

    const purposeTextEn: Record<VerificationCodeEmailPayload['purpose'], string> = {
      signup: 'Use the code below to verify your email and finish creating your Handla account.',
      login: 'Use the code below to finish signing in to your Handla account.',
      google: 'Use the code below to finish signing in with Google.',
      reset: 'Use the code below to verify your identity and reset your password.',
    };
    const purposeTextAr: Record<VerificationCodeEmailPayload['purpose'], string> = {
      signup: 'استخدم الرمز أدناه للتحقق من بريدك الإلكتروني وإكمال إنشاء حسابك في Handla.',
      login: 'استخدم الرمز أدناه لإكمال تسجيل الدخول إلى حسابك في Handla.',
      google: 'استخدم الرمز أدناه لإكمال تسجيل الدخول عبر Google.',
      reset: 'استخدم الرمز أدناه للتحقق من هويتك وإعادة تعيين كلمة المرور.',
    };

    const t = isAr
      ? {
          title: 'رمز التحقق — Handla',
          preheader: `رمز التحقق الخاص بك هو ${payload.code}. ينتهي خلال ${payload.expiresInMinutes} دقائق.`,
          greeting: name ? `مرحباً ${name}` : 'مرحباً',
          purpose: purposeTextAr[payload.purpose],
          expiry: `ينتهي هذا الرمز خلال ${payload.expiresInMinutes} دقائق.`,
          security:
            'لأمانك، لا تشارك هذا الرمز مع أي شخص. لن يطلب منك فريق Handla هذا الرمز أبداً. إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.',
          rights: 'جميع الحقوق محفوظة.',
          autoNote: 'هذه رسالة تلقائية، يرجى عدم الرد عليها مباشرة.',
        }
      : {
          title: 'Your verification code — Handla',
          preheader: `Your verification code is ${payload.code}. It expires in ${payload.expiresInMinutes} minutes.`,
          greeting: name ? `Hi ${name}` : 'Hi there',
          purpose: purposeTextEn[payload.purpose],
          expiry: `This code expires in ${payload.expiresInMinutes} minutes.`,
          security:
            'For your security, never share this code with anyone. The Handla team will never ask you for it. If you did not request this code, you can safely ignore this email.',
          rights: 'All rights reserved.',
          autoNote: 'This is an automated message — please do not reply directly.',
        };

    const html = await this.renderTemplate('verification-code', {
      code: payload.code,
      lang: isAr ? 'ar' : 'en',
      dir: isAr ? 'rtl' : 'ltr',
      align: isAr ? 'right' : 'left',
      t,
      year: new Date().getFullYear(),
    });

    await this.sendMail({
      to: payload.recipientEmail,
      subject: isAr
        ? `رمز التحقق الخاص بك: ${payload.code} — Handla`
        : `Your Handla verification code: ${payload.code}`,
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
    // Defense-in-depth: reject recipients containing CR/LF or other control
    // characters BEFORE handing off to the SMTP layer. Recipient addresses are
    // already validated upstream by class-validator `@IsEmail` at the DTO
    // boundary, but this explicit mail-layer guard ensures a malformed/injected
    // recipient can never be parsed into an unintended envelope recipient or
    // smuggled header — independent of any single upstream validator.
    this.assertSafeRecipient(options.to);

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        replyTo: this.replyTo,
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

  /**
   * Reject a recipient string that contains CR/LF or other control characters.
   *
   * This is an explicit mail-layer defense against email header injection: a
   * value such as `victim@example.com\r\nBcc: attacker@evil.com` must never be
   * handed to the transport, where an address parser could otherwise fold it
   * into an unintended envelope recipient or a smuggled header. The bare
   * address is NOT further shape-validated here (nodemailer/SMTP still own that)
   * — this guard exists purely to block control-character injection.
   *
   * Throws a generic error that leaks no SMTP credentials or connection detail.
   */
  private assertSafeRecipient(to: unknown): void {
    if (typeof to !== 'string' || to.length === 0) {
      throw new Error('Invalid email recipient');
    }
    // Any CR, LF, NUL or other C0/C1 control character is disallowed.
    // eslint-disable-next-line no-control-regex
    if (/[\r\n\u0000-\u001f\u007f]/.test(to)) {
      throw new Error('Invalid email recipient');
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
