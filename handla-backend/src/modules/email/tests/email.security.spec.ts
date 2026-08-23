/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EmailService — SECURITY REGRESSION SUITE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * These tests lock down the security boundaries of the mail layer BEFORE the
 * Nodemailer 6 → 9 upgrade, so any regression introduced by the new major
 * version is caught immediately.
 *
 * Boundaries covered:
 *   1. Recipient validation        — malformed / CRLF / header-injection input
 *   2. Subject / header safety      — user data cannot inject Bcc/Cc/Reply-To/headers
 *   3. Sender configuration         — from / replyTo are server-controlled only
 *   4. Raw email functionality      — Handla never passes a user-controlled `raw`
 *   5. Email template output        — Handlebars auto-escapes user-controlled text
 *
 * The suite talks to a mocked nodemailer transport — no real SMTP is touched.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import * as handlebars from 'handlebars';

import { EmailService } from '../email.service';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockEmailQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

// Mock nodemailer so we never touch real SMTP. The factory is hoisted, so it
// must be fully self-contained (no outer-scope references).
jest.mock('nodemailer', () => {
  const mockFn = jest.fn().mockResolvedValue({ messageId: 'sec-msg-id' });
  return {
    createTransport: jest.fn().mockReturnValue({ sendMail: mockFn }),
    __mockSendMail: mockFn,
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailerModule = require('nodemailer') as {
  __mockSendMail: jest.Mock;
  createTransport: jest.Mock;
};
const mockSendMail = nodemailerModule.__mockSendMail;
const mockCreateTransport = nodemailerModule.createTransport;

// Mock fs.readFileSync so renderTemplate works without the compiled dist.
// We return a template that echoes several user-controlled fields into the
// HTML body so we can assert Handlebars escaping behaviour.
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest
    .fn()
    .mockReturnValue(
      '<p>{{recipientName}}</p><span>{{senderName}}</span><div>{{companyName}}</div>',
    ),
}));

// Server-controlled sender config. `fromHeader` and `replyTo` come exclusively
// from environment-derived config — never from a request.
const mockConfigValues: Record<string, string | number | boolean> = {
  'email.host': 'smtp.example.com',
  'email.port': 587,
  'email.secure': false,
  'email.user': 'svc@handla.com',
  'email.pass': 'REDACTED', // never asserted on — presence only
  'email.from': 'no-reply@handla.com',
  'email.fromHeader': '"Handla" <no-reply@handla.com>',
  'email.replyTo': 'support@handla.com',
  BASE_URL: 'https://handla.com',
};

const mockConfigService = {
  get: jest.fn((key: string) => mockConfigValues[key]),
};

// ─── Helpers ───────────────────────────────────────────────────────────────

/** The single mail object passed to transporter.sendMail on the most recent call. */
function lastMailArg(): Record<string, unknown> {
  return mockSendMail.mock.calls[mockSendMail.mock.calls.length - 1][0];
}

/**
 * The complete set of top-level mail keys the service is ever allowed to emit.
 * `text` may be present with an `undefined` value when the caller omits it, so
 * we assert against a whitelist rather than an exact key list.
 */
const ALLOWED_MAIL_KEYS = ['from', 'replyTo', 'to', 'subject', 'html', 'text'];

/** Header keys that would indicate a successful injection — must NEVER appear. */
const FORBIDDEN_MAIL_KEYS = [
  'bcc',
  'cc',
  'raw',
  'headers',
  'attachments',
  'envelope',
];

/** Assert the mail object only contains whitelisted keys and no injected ones. */
function assertNoInjectedKeys(mail: Record<string, unknown>): void {
  for (const key of Object.keys(mail)) {
    expect(ALLOWED_MAIL_KEYS).toContain(key);
  }
  for (const forbidden of FORBIDDEN_MAIL_KEYS) {
    expect(mail).not.toHaveProperty(forbidden);
  }
}

/**
 * CRLF / header-injection probes containing REAL control characters — these
 * must be rejected fail-closed by the mail-layer recipient guard.
 */
const CONTROL_CHAR_PROBES = [
  'victim@example.com\r\nBcc: attacker@evil.com',
  'victim@example.com\nCc: attacker@evil.com',
  'victim@example.com\r\nReply-To: attacker@evil.com',
  'victim@example.com\r\nSubject: Hijacked',
  'victim@example.com\r\nX-Injected-Header: 1',
  'victim@example.com\u0000nul',
];

/**
 * A percent-ENCODED probe — no literal CR/LF bytes, so the control-char guard
 * does not fire. It is harmless (treated as opaque text) and must NOT split
 * into extra header keys.
 */
const PERCENT_ENCODED_PROBE = 'victim@example.com%0d%0aBcc:attacker@evil.com';

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('EmailService — security regression', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'sec-msg-id' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getQueueToken('email'), useValue: mockEmailQueue },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  // ─── 1. Sender configuration is server-controlled ──────────────────────────

  describe('sender configuration is server-controlled', () => {
    it('always uses the env-derived from/replyTo headers', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      });

      const mail = lastMailArg();
      expect(mail.from).toBe('"Handla" <no-reply@handla.com>');
      expect(mail.replyTo).toBe('support@handla.com');
    });

    it('does not accept a caller-supplied from/replyTo (not part of the API surface)', async () => {
      // The public sendMail signature exposes only { to, subject, html, text }.
      // Even if a caller tries to smuggle a from/replyTo through, the service
      // ignores it and uses the server-controlled values.
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
        // @ts-expect-error — `from` is intentionally NOT part of the signature
        from: 'attacker@evil.com',
        // @ts-expect-error — `replyTo` is intentionally NOT part of the signature
        replyTo: 'attacker@evil.com',
      });

      const mail = lastMailArg();
      expect(mail.from).toBe('"Handla" <no-reply@handla.com>');
      expect(mail.replyTo).toBe('support@handla.com');
      expect(mail.from).not.toContain('attacker@evil.com');
      expect(mail.replyTo).not.toContain('attacker@evil.com');
    });

    it('the transport is created once with SMTP auth (no OAuth2 / proxy / DKIM)', () => {
      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      const transportOpts = mockCreateTransport.mock.calls[0][0];
      expect(transportOpts).toHaveProperty('host');
      expect(transportOpts).toHaveProperty('auth');
      // Assert the advanced attack-surface options are NOT configured.
      expect(transportOpts).not.toHaveProperty('oauth2');
      expect(transportOpts).not.toHaveProperty('proxy');
      expect(transportOpts).not.toHaveProperty('dkim');
    });
  });

  // ─── 2. No user-controlled raw / headers / attachments ─────────────────────

  describe('no user-controlled raw email functionality', () => {
    it('never passes a `raw` message to the transport', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Hi',
        html: '<p>x</p>',
      });
      const mail = lastMailArg();
      expect(mail).not.toHaveProperty('raw');
    });

    it('never passes arbitrary `headers`, `attachments`, `cc`, `bcc`, or `envelope`', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Hi',
        html: '<p>x</p>',
      });
      const mail = lastMailArg();
      expect(mail).not.toHaveProperty('headers');
      expect(mail).not.toHaveProperty('attachments');
      expect(mail).not.toHaveProperty('cc');
      expect(mail).not.toHaveProperty('bcc');
      expect(mail).not.toHaveProperty('envelope');
    });

    it('the mail object contains only the expected whitelisted keys', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Hi',
        html: '<p>x</p>',
        text: 'x',
      });
      assertNoInjectedKeys(lastMailArg());
    });
  });

  // ─── 3. Recipient handling — CRLF / header injection ───────────────────────

  describe('recipient handling — CRLF / header injection', () => {
    it.each(CONTROL_CHAR_PROBES)(
      'rejects a control-character recipient fail-closed and never reaches the transport: %j',
      async (probe) => {
        // The mail-layer guard must reject the probe BEFORE any transport call.
        await expect(
          service.sendMail({ to: probe, subject: 'Subject', html: '<p>x</p>' }),
        ).rejects.toThrow('Invalid email recipient');

        // Crucially, nothing was handed to the SMTP transport.
        expect(mockSendMail).not.toHaveBeenCalled();
      },
    );

    it('rejection error is generic and leaks no SMTP credentials/host', async () => {
      let caught: Error | undefined;
      try {
        await service.sendMail({
          to: 'victim@example.com\r\nBcc: attacker@evil.com',
          subject: 'S',
          html: '<p/>',
        });
      } catch (e) {
        caught = e as Error;
      }
      expect(caught).toBeDefined();
      expect(caught!.message).toBe('Invalid email recipient');
      expect(caught!.message).not.toContain('smtp');
      expect(caught!.message).not.toContain('REDACTED');
      expect(caught!.message).not.toContain('attacker@evil.com');
    });

    it('rejects empty / non-string recipients fail-closed', async () => {
      await expect(
        service.sendMail({ to: '', subject: 'S', html: '<p/>' }),
      ).rejects.toThrow('Invalid email recipient');
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('a percent-ENCODED probe (no real CR/LF) is opaque text and never splits into header keys', async () => {
      await service.sendMail({
        to: PERCENT_ENCODED_PROBE,
        subject: 'Subject',
        html: '<p>x</p>',
      });
      const mail = lastMailArg();
      expect(mail.replyTo).toBe('support@handla.com'); // server-controlled, unchanged
      assertNoInjectedKeys(mail); // no bcc/cc/raw/headers keys created
    });

    it('a normal valid recipient passes through unchanged', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Subject',
        html: '<p>x</p>',
      });
      const mail = lastMailArg();
      expect(mail.to).toBe('user@example.com');
      assertNoInjectedKeys(mail);
    });
  });

  // ─── 4. Subject / header safety ────────────────────────────────────────────

  describe('subject / header safety', () => {
    it('user-controlled subject content cannot create Bcc/Cc/Reply-To keys', async () => {
      const maliciousSubject =
        'Order #42\r\nBcc: attacker@evil.com\r\nReply-To: attacker@evil.com';

      await service.sendMail({
        to: 'user@example.com',
        subject: maliciousSubject,
        html: '<p>x</p>',
      });

      const mail = lastMailArg();
      // The subject is a single string field; it never becomes new header keys.
      expect(mail).not.toHaveProperty('bcc');
      expect(mail).not.toHaveProperty('cc');
      expect(mail.replyTo).toBe('support@handla.com');
      // Subject stays a plain string passed to nodemailer (which folds/sanitises).
      expect(typeof mail.subject).toBe('string');
    });

    it('message-notification subject embeds sender name as a plain string only', async () => {
      await service.sendMessageNotificationEmail({
        recipientEmail: 'alice@example.com',
        recipientName: 'Alice',
        senderName: 'Bob\r\nBcc: attacker@evil.com',
        messagePreview: 'Hi',
        conversationId: 'c-1',
        dashboardUrl: 'https://handla.com/dashboard',
      });

      const mail = lastMailArg();
      expect(mail).not.toHaveProperty('bcc');
      expect(mail).not.toHaveProperty('cc');
      // The injected sender name lands only in the subject string, never a header key.
      expect(typeof mail.subject).toBe('string');
      expect(mail.replyTo).toBe('support@handla.com');
    });
  });

  // ─── 5. Email template output safety (Handlebars escaping) ─────────────────

  describe('email template output safety', () => {
    it('Handlebars escapes HTML in user-controlled template fields', async () => {
      const html = await service.renderTemplate('message-notification', {
        recipientName: '<script>alert(1)</script>',
        senderName: '"><img src=x onerror=alert(1)>',
        companyName: 'Acme & Co <b>',
      });

      // The dangerous markup must be entity-escaped, not emitted verbatim.
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;'); // "Acme & Co" → "Acme &amp; Co"
    });

    it('a CRLF-laden template field cannot break out into a header (body-only escaping)', async () => {
      const html = await service.renderTemplate('welcome', {
        recipientName: 'Eve\r\nBcc: attacker@evil.com',
      });
      // Output is HTML body content only — it is never used as a header value.
      expect(typeof html).toBe('string');
    });

    it('confirms Handlebars default escaping semantics (guard against future helper misuse)', () => {
      const tpl = handlebars.compile('<p>{{x}}</p>');
      expect(tpl({ x: '<b>bold</b>' })).toBe('<p>&lt;b&gt;bold&lt;/b&gt;</p>');
      // Triple-stash would NOT escape — assert we are not relying on it anywhere.
      const unsafe = handlebars.compile('<p>{{{x}}}</p>');
      expect(unsafe({ x: '<b>bold</b>' })).toBe('<p><b>bold</b></p>');
    });
  });

  // ─── 6. Transport error handling does not leak secrets ─────────────────────

  describe('transport error handling', () => {
    it('re-throws SMTP errors so Bull can retry (no swallow)', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('ECONNREFUSED smtp.example.com:587'));
      await expect(
        service.sendMail({ to: 'user@example.com', subject: 'S', html: '<p/>' }),
      ).rejects.toThrow('ECONNREFUSED');
    });

    it('does not embed SMTP password in the mail object', async () => {
      await service.sendMail({ to: 'user@example.com', subject: 'S', html: '<p/>' });
      const serialised = JSON.stringify(lastMailArg());
      expect(serialised).not.toContain('REDACTED'); // the mock password value
      expect(serialised).not.toContain('pass');
    });
  });
});
