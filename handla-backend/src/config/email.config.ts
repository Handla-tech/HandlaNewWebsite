import { registerAs } from '@nestjs/config';

/**
 * Email / SMTP configuration.
 *
 * `secure` semantics (Nodemailer): true = implicit TLS (port 465);
 * false = plain/STARTTLS (port 587). A common misconfiguration is setting the
 * wrong `secure` for the port, which manifests as auth/handshake failures. To
 * avoid that footgun we DERIVE `secure` from the port unless it is explicitly
 * pinned via MAIL_SECURE. Gmail App Passwords are frequently pasted with the
 * grouping spaces Google shows (e.g. "abcd efgh ijkl mnop") — those spaces are
 * not part of the credential, so we strip whitespace from the password.
 *
 * ── "From" / "Reply-To" address ──────────────────────────────────────────────
 * The SMTP relay authenticates as MAIL_USER, but the address recipients SEE is
 * the "From" header, composed from MAIL_FROM_NAME + MAIL_FROM (e.g.
 *   "Handla Support" <support@handla.com>
 * ).
 *
 * IMPORTANT: most providers (including Gmail/Google Workspace) will only let
 * you send with a From address you are AUTHORIZED to use — i.e. the
 * authenticated mailbox itself, or a verified "Send mail as" alias / a real
 * domain mailbox. If MAIL_FROM is an unverified address the provider may
 * rewrite the header or reject the message. When you cannot (yet) send AS
 * support@handla.com, keep MAIL_FROM = the authenticated mailbox and set
 * MAIL_REPLY_TO=support@handla.com so client replies still land in the support
 * inbox. Once support@handla.com is a verified alias / Workspace mailbox, set
 * MAIL_FROM=support@handla.com directly.
 */
export default registerAs('email', () => {
  const port = parseInt(process.env.MAIL_PORT || '587', 10);
  const secureExplicit = process.env.MAIL_SECURE;

  const secure =
    secureExplicit === undefined || secureExplicit === ''
      ? port === 465 // derive: only port 465 uses implicit TLS
      : secureExplicit === 'true';

  const fromAddress = (process.env.MAIL_FROM || 'no-reply@handla.com').trim();
  const fromName = (process.env.MAIL_FROM_NAME || 'Handla').trim();
  const replyTo = (process.env.MAIL_REPLY_TO || '').trim();

  return {
    host: (process.env.MAIL_HOST || 'smtp.gmail.com').trim(),
    port,
    secure,
    user: (process.env.MAIL_USER || '').trim(),
    // App passwords are often copied with spaces — strip ALL whitespace.
    pass: (process.env.MAIL_PASS || '').replace(/\s+/g, ''),
    // Bare envelope-from address (used for the SMTP envelope / return-path).
    from: fromAddress,
    // Optional human-friendly display name shown in mail clients.
    fromName,
    // Composed RFC 5322 From header, e.g. `"Handla Support" <support@handla.com>`.
    fromHeader: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
    // Where client replies should go. Falls back to the From address.
    replyTo: replyTo || fromAddress,
  };
});
