/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EmailProcessor — QUEUE BEHAVIOUR SUITE (Bull)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Verifies the email queue worker's control flow — independent of the SMTP
 * transport — so the Nodemailer 6 → 9 upgrade cannot silently change retry /
 * failed-job semantics:
 *
 *   - a dequeued job is processed by delegating to the matching EmailService
 *     send method (successful processing)
 *   - a send failure is RE-THROWN so Bull records the failure and retries
 *     (retry / failed-job behaviour; EMAIL_JOB_OPTIONS = 3 attempts)
 *   - no duplicate send occurs for a single successful job
 *
 * EmailService is fully mocked — no Redis, no SMTP.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bull';

import { EmailProcessor } from '../email.processor';
import { EmailService, EMAIL_JOB_OPTIONS } from '../email.service';

// A minimal EmailService mock exposing only the methods the processor calls.
const mockEmailService = {
  sendMessageNotificationEmail: jest.fn().mockResolvedValue(undefined),
  sendResponseNotificationEmail: jest.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendUserCreatedEmail: jest.fn().mockResolvedValue(undefined),
  sendContractSentEmail: jest.fn().mockResolvedValue(undefined),
  sendInvoiceCreatedEmail: jest.fn().mockResolvedValue(undefined),
};

/** Build a fake Bull Job with the given data + attemptsMade. */
function fakeJob<T>(data: T, attemptsMade = 0): Job<T> {
  return { id: 'job-1', data, attemptsMade } as unknown as Job<T>;
}

describe('EmailProcessor — queue behaviour', () => {
  let processor: EmailProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();
    processor = module.get<EmailProcessor>(EmailProcessor);
  });

  it('processes a message-notification job by delegating to EmailService once', async () => {
    const data = {
      recipientEmail: 'alice@example.com',
      recipientName: 'Alice',
      senderName: 'Bob',
      messagePreview: 'Hi',
      conversationId: 'c-1',
      dashboardUrl: 'https://handla.com/dashboard',
    };

    await processor.handleMessageNotification(fakeJob(data));

    expect(mockEmailService.sendMessageNotificationEmail).toHaveBeenCalledTimes(1);
    expect(mockEmailService.sendMessageNotificationEmail).toHaveBeenCalledWith(data);
  });

  it('re-throws on send failure so Bull records the failure and retries', async () => {
    mockEmailService.sendWelcomeEmail.mockRejectedValueOnce(
      new Error('ECONNREFUSED smtp.example.com:587'),
    );

    await expect(
      processor.handleWelcomeEmail(
        fakeJob({
          recipientEmail: 'x@example.com',
          userName: 'X',
          dashboardUrl: 'https://handla.com/dashboard',
        }),
      ),
    ).rejects.toThrow('ECONNREFUSED');
  });

  it('surfaces a fail-closed "Invalid email recipient" error to Bull (failed-job path)', async () => {
    mockEmailService.sendUserCreatedEmail.mockRejectedValueOnce(
      new Error('Invalid email recipient'),
    );

    await expect(
      processor.handleUserCreatedEmail(
        fakeJob({
          recipientEmail: 'bad\r\nBcc: attacker@evil.com',
          userName: 'X',
          temporaryPassword: 'tmp',
          dashboardUrl: 'https://handla.com/dashboard',
        }),
      ),
    ).rejects.toThrow('Invalid email recipient');
  });

  it('does not double-send on a single successful job', async () => {
    await processor.handleContractSent(
      fakeJob({
        recipientEmail: 'client@test.com',
        recipientName: 'Alice',
        contractTitle: 'SLA',
        contractId: 'c-1',
        erpUrl: 'https://handla.com/erp/contracts/c-1',
      }),
    );
    expect(mockEmailService.sendContractSentEmail).toHaveBeenCalledTimes(1);
  });

  it('the queue retry policy is 3 attempts with exponential backoff', () => {
    // Guards against an accidental change to the shared job options that would
    // alter retry/failed-job behaviour.
    expect(EMAIL_JOB_OPTIONS.attempts).toBe(3);
    expect(EMAIL_JOB_OPTIONS.backoff).toEqual({ type: 'exponential', delay: 2000 });
    expect(EMAIL_JOB_OPTIONS.removeOnFail).toBe(false); // keep failed jobs for inspection
  });
});
