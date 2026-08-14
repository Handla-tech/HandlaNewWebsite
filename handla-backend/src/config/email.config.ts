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
 */
export default registerAs('email', () => {
  const port = parseInt(process.env.MAIL_PORT || '587', 10);
  const secureExplicit = process.env.MAIL_SECURE;

  const secure =
    secureExplicit === undefined || secureExplicit === ''
      ? port === 465 // derive: only port 465 uses implicit TLS
      : secureExplicit === 'true';

  return {
    host: (process.env.MAIL_HOST || 'smtp.gmail.com').trim(),
    port,
    secure,
    user: (process.env.MAIL_USER || '').trim(),
    // App passwords are often copied with spaces — strip ALL whitespace.
    pass: (process.env.MAIL_PASS || '').replace(/\s+/g, ''),
    from: (process.env.MAIL_FROM || 'no-reply@handla.com').trim(),
  };
});
