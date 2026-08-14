import { registerAs } from '@nestjs/config';

/**
 * Authentication tuning for the OTP + Google OAuth layer.
 *
 * All values overridable via env with safe production-minded defaults. NO
 * secrets are hardcoded — Google credentials come from the environment and
 * default to empty (the Google button is disabled server-side when unset).
 */
export default registerAs('auth', () => ({
  // ─── OTP / email verification ──────────────────────────────────────────────
  otp: {
    /** Number of digits in the code. */
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
    /** Lifetime in seconds (default 10 min — inside the 5-10 min guidance). */
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '600', 10),
    /** Max wrong guesses before the code is burned. */
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
    /** Cooldown (seconds) between resend requests. */
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '45', 10),
  },

  // ─── Google OAuth 2.0 ───────────────────────────────────────────────────────
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    // Backend callback the Google consent screen redirects back to.
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      'http://localhost:3001/api/auth/google/callback',
  },

  /** Frontend origin used to build redirect targets after OAuth. */
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
}));
