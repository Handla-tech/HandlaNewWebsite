/**
 * Centralized security tuning constants.
 *
 * Keeping these in one place avoids drift (e.g. different bcrypt cost factors
 * across register / admin-create / password-reset paths, which was previously
 * the case).
 */

/**
 * bcrypt cost factor. 12 is the current OWASP-recommended baseline for
 * interactive logins — meaningfully stronger than 10 while staying well under
 * the ~250ms/verify budget on modern hardware. Overridable via BCRYPT_ROUNDS
 * for environments that need to tune the CPU cost.
 */
export const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
