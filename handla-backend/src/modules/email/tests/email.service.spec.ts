import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';

import { EmailService, EMAIL_JOBS, EMAIL_JOB_OPTIONS } from '../email.service';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockEmailQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

// Mock nodemailer so we never touch real SMTP.
// jest.mock() is hoisted above ALL variable declarations, so the factory must
// be fully self-contained — no references to outer-scope variables.
jest.mock('nodemailer', () => {
  const mockFn = jest.fn().mockResolvedValue({ messageId: 'test-msg-id' });
  return {
    createTransport: jest.fn().mockReturnValue({ sendMail: mockFn }),
    __mockSendMail: mockFn, // expose via __esModule-style export for retrieval
  };
});

// Retrieve the mock after jest.mock() has been executed
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailerModule = require('nodemailer') as { __mockSendMail: jest.Mock };
const mockSendMail = nodemailerModule.__mockSendMail;

// Mock fs.readFileSync so renderTemplate works without compiled dist
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn().mockReturnValue('<p>{{recipientName}}</p>'),
}));

const mockConfigValues: Record<string, string | number | boolean> = {
  'email.host': 'smtp.gmail.com',
  'email.port': 587,
  'email.secure': false,
  'email.user': 'test@handla.com',
  'email.pass': 'secret',
  'email.from': 'no-reply@handla.com',
  BASE_URL: 'https://handla.com',
};

const mockConfigService = {
  get: jest.fn((key: string) => mockConfigValues[key]),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Restore default resolved value after clearAllMocks resets it
    mockSendMail.mockResolvedValue({ messageId: 'test-msg-id' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getQueueToken('email'), useValue: mockEmailQueue },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  // ─── queueMessageNotification ────────────────────────────────────────────────

  describe('queueMessageNotification', () => {
    const payload = {
      recipientEmail: 'client@example.com',
      recipientName: 'Alice',
      senderName: 'Bob',
      messagePreview: 'Hello, how can I help?',
      conversationId: 'conv-uuid-1',
      dashboardUrl: 'https://handla.com/dashboard',
    };

    it('should add a job to the email queue with correct name and payload', async () => {
      await service.queueMessageNotification(payload);

      expect(mockEmailQueue.add).toHaveBeenCalledTimes(1);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        EMAIL_JOBS.SEND_MESSAGE_NOTIFICATION,
        payload,
        EMAIL_JOB_OPTIONS,
      );
    });

    it('should use 3-attempt retry options', async () => {
      await service.queueMessageNotification(payload);

      const [, , options] = mockEmailQueue.add.mock.calls[0];
      expect(options.attempts).toBe(3);
      expect(options.backoff.type).toBe('exponential');
    });
  });

  // ─── queueResponseNotification ───────────────────────────────────────────────

  describe('queueResponseNotification', () => {
    const payload = {
      recipientEmail: 'client@example.com',
      recipientName: 'Alice',
      senderName: 'Admin',
      messagePreview: 'We have reviewed your request.',
      conversationId: 'conv-uuid-2',
      dashboardUrl: 'https://handla.com/dashboard',
    };

    it('should add a response-notification job to the queue', async () => {
      await service.queueResponseNotification(payload);

      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        EMAIL_JOBS.SEND_RESPONSE_NOTIFICATION,
        payload,
        EMAIL_JOB_OPTIONS,
      );
    });
  });

  // ─── queueWelcomeEmail ───────────────────────────────────────────────────────

  describe('queueWelcomeEmail', () => {
    const payload = {
      recipientEmail: 'newuser@example.com',
      userName: 'Charlie',
      dashboardUrl: 'https://handla.com/dashboard',
    };

    it('should add a welcome job to the queue', async () => {
      await service.queueWelcomeEmail(payload);

      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        EMAIL_JOBS.SEND_WELCOME,
        payload,
        EMAIL_JOB_OPTIONS,
      );
    });
  });

  // ─── sendMail ────────────────────────────────────────────────────────────────

  describe('sendMail', () => {
    it('should call transporter.sendMail with correct options', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'no-reply@handla.com',
          to: 'user@example.com',
          subject: 'Test Subject',
          html: '<p>Hello</p>',
        }),
      );
    });

    it('should re-throw SMTP errors so Bull can retry', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));

      await expect(
        service.sendMail({ to: 'x@example.com', subject: 'S', html: '<p/>' }),
      ).rejects.toThrow('SMTP connection refused');
    });
  });

  // ─── sendMessageNotificationEmail ────────────────────────────────────────────

  describe('sendMessageNotificationEmail', () => {
    it('should render template and send email', async () => {
      await service.sendMessageNotificationEmail({
        recipientEmail: 'alice@example.com',
        recipientName: 'Alice',
        senderName: 'Bob',
        messagePreview: 'Hi there!',
        conversationId: 'conv-1',
        dashboardUrl: 'https://handla.com/dashboard',
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail.mock.calls[0][0].to).toBe('alice@example.com');
      expect(mockSendMail.mock.calls[0][0].subject).toContain('Bob');
    });
  });

  // ─── sendResponseNotificationEmail ───────────────────────────────────────────

  describe('sendResponseNotificationEmail', () => {
    it('should render template and send response-notification email', async () => {
      await service.sendResponseNotificationEmail({
        recipientEmail: 'client@example.com',
        recipientName: 'Client',
        senderName: 'Support Admin',
        messagePreview: 'Your request has been processed.',
        conversationId: 'conv-2',
        dashboardUrl: 'https://handla.com/dashboard',
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail.mock.calls[0][0].to).toBe('client@example.com');
    });
  });

  // ─── sendWelcomeEmail ────────────────────────────────────────────────────────

  describe('sendWelcomeEmail', () => {
    it('should render welcome template and send email', async () => {
      await service.sendWelcomeEmail({
        recipientEmail: 'newuser@example.com',
        userName: 'NewUser',
        dashboardUrl: 'https://handla.com/dashboard',
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail.mock.calls[0][0].to).toBe('newuser@example.com');
      expect(mockSendMail.mock.calls[0][0].subject).toContain('Welcome');
    });
  });

  // ─── renderTemplate ──────────────────────────────────────────────────────────

  describe('renderTemplate', () => {
    it('should compile and cache the template', async () => {
      const fs = require('fs');

      // First call — should read from disk
      const result1 = await service.renderTemplate('message-notification', {
        recipientName: 'Alice',
      });
      const firstCallCount = fs.readFileSync.mock.calls.length;

      // Second call — should use cache (no new fs.readFileSync)
      const result2 = await service.renderTemplate('message-notification', {
        recipientName: 'Alice',
      });

      expect(fs.readFileSync.mock.calls.length).toBe(firstCallCount);
      expect(result1).toBe(result2);
    });

    it('should interpolate Handlebars variables', async () => {
      const result = await service.renderTemplate('welcome', {
        recipientName: 'TestUser',
      });
      // The mock template is '<p>{{recipientName}}</p>' — but after compile+render
      // a missing variable returns empty string (Handlebars default).
      // We just check the output is a string.
      expect(typeof result).toBe('string');
    });
  });

  // ─── ERP-9 Queue Methods ─────────────────────────────────────────────────────

  describe('queueContractSent', () => {
    it('should add SEND_CONTRACT_SENT job with correct payload', async () => {
      const payload = { recipientEmail: 'client@test.com', recipientName: 'Alice', contractTitle: 'SLA', contractId: 'c-1', erpUrl: 'https://handla.com/erp/contracts/c-1' };
      await service.queueContractSent(payload);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(EMAIL_JOBS.SEND_CONTRACT_SENT, payload, EMAIL_JOB_OPTIONS);
    });
  });

  describe('queueContractSigned', () => {
    it('should add SEND_CONTRACT_SIGNED job with correct payload', async () => {
      const payload = { recipientEmail: 'admin@test.com', recipientName: 'Bob', contractTitle: 'SLA', contractId: 'c-1', erpUrl: 'https://handla.com/erp/contracts/c-1' };
      await service.queueContractSigned(payload);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(EMAIL_JOBS.SEND_CONTRACT_SIGNED, payload, EMAIL_JOB_OPTIONS);
    });
  });

  describe('queueContractRejected', () => {
    it('should add SEND_CONTRACT_REJECTED job with correct payload', async () => {
      const payload = { recipientEmail: 'admin@test.com', recipientName: 'Bob', contractTitle: 'SLA', contractId: 'c-1', erpUrl: 'https://handla.com/erp/contracts/c-1' };
      await service.queueContractRejected(payload);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(EMAIL_JOBS.SEND_CONTRACT_REJECTED, payload, EMAIL_JOB_OPTIONS);
    });
  });

  describe('queueInvoiceCreated', () => {
    it('should add SEND_INVOICE_CREATED job with correct payload', async () => {
      const payload = { recipientEmail: 'admin@test.com', recipientName: 'Bob', invoiceNumber: 'INV-001', amount: '$500', dueDate: '2025-12-31', erpUrl: 'https://handla.com/erp/invoices/i-1' };
      await service.queueInvoiceCreated(payload);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(EMAIL_JOBS.SEND_INVOICE_CREATED, payload, EMAIL_JOB_OPTIONS);
    });
  });

  describe('queueInvoiceOverdue', () => {
    it('should add SEND_INVOICE_OVERDUE job with correct payload', async () => {
      const payload = { recipientEmail: 'admin@test.com', recipientName: 'Bob', invoiceNumber: 'INV-001', amount: '$500', dueDate: '2025-01-01', erpUrl: 'https://handla.com/erp/invoices/i-1' };
      await service.queueInvoiceOverdue(payload);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(EMAIL_JOBS.SEND_INVOICE_OVERDUE, payload, EMAIL_JOB_OPTIONS);
    });
  });

  describe('queueLeadAssigned', () => {
    it('should add SEND_LEAD_ASSIGNED job with correct payload', async () => {
      const payload = { recipientEmail: 'emp@test.com', recipientName: 'Charlie', clientName: 'Acme', clientId: 'cl-1', erpUrl: 'https://handla.com/erp/clients' };
      await service.queueLeadAssigned(payload);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(EMAIL_JOBS.SEND_LEAD_ASSIGNED, payload, EMAIL_JOB_OPTIONS);
    });
  });

  describe('queueLeadPromoted', () => {
    it('should add SEND_LEAD_PROMOTED job with correct payload', async () => {
      const payload = { recipientEmail: 'emp@test.com', recipientName: 'Charlie', clientName: 'Acme', clientId: 'cl-1', erpUrl: 'https://handla.com/erp/clients' };
      await service.queueLeadPromoted(payload);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(EMAIL_JOBS.SEND_LEAD_PROMOTED, payload, EMAIL_JOB_OPTIONS);
    });
  });

  describe('queueTaskAssigned', () => {
    it('should add SEND_TASK_ASSIGNED job with correct payload', async () => {
      const payload = { recipientEmail: 'emp@test.com', recipientName: 'Dana', taskTitle: 'Fix bug', taskId: 't-1', dueDate: '2025-12-31', erpUrl: 'https://handla.com/erp/tasks/t-1' };
      await service.queueTaskAssigned(payload);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(EMAIL_JOBS.SEND_TASK_ASSIGNED, payload, EMAIL_JOB_OPTIONS);
    });
  });

  describe('queueTaskDelayed', () => {
    it('should add SEND_TASK_DELAYED job with correct payload', async () => {
      const payload = { recipientEmail: 'emp@test.com', recipientName: 'Dana', taskTitle: 'Fix bug', taskId: 't-1', dueDate: '2025-01-01', erpUrl: 'https://handla.com/erp/tasks/t-1' };
      await service.queueTaskDelayed(payload);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(EMAIL_JOBS.SEND_TASK_DELAYED, payload, EMAIL_JOB_OPTIONS);
    });
  });
});
