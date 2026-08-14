import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Purpose of a one-time verification code. A single table backs every OTP flow
 * so there is exactly one OTP service + one verification UI (no parallel
 * systems). The purpose scopes a code to the flow that created it.
 */
export enum VerificationPurpose {
  /** Confirm a newly-created (pending) email/password signup. */
  SIGNUP = 'SIGNUP',
  /** Second factor after a valid email/password login. */
  LOGIN = 'LOGIN',
  /** Second factor after a successful Google OAuth identify. */
  GOOGLE = 'GOOGLE',
  /** Ownership check before allowing a password reset. */
  PASSWORD_RESET = 'PASSWORD_RESET',
}

/**
 * Short-lived email verification / OTP record.
 *
 * Security properties enforced by the OtpService that owns this table:
 *  - The 6-digit code is NEVER stored in plaintext — only a bcrypt hash.
 *  - Codes expire (`expiresAt`) after a short window (5-10 min).
 *  - `attemptCount` caps how many wrong guesses are allowed before the code
 *    is burned and the user must request a new one.
 *  - `consumedAt` marks single-use: a code is invalidated the instant it is
 *    used successfully, so it can never be replayed.
 *  - Older un-consumed codes for the same (email, purpose) are invalidated
 *    whenever a new one is issued.
 *
 * Keyed by lowercased `email` rather than a user id so it also works for the
 * pending-signup flow, where no verified user row exists yet.
 */
@Index('idx_email_verifications_lookup', ['email', 'purpose'])
@Entity('email_verifications')
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Lowercased email the code was issued for. */
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /** Optional link to a real user row (NULL for pending signups). */
  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true, default: null })
  userId: string | null;

  /** bcrypt hash of the 6-digit code. Never the code itself. */
  @Column({ name: 'code_hash', type: 'varchar', length: 255 })
  codeHash: string;

  @Column({ type: 'enum', enum: VerificationPurpose })
  purpose: VerificationPurpose;

  /**
   * Opaque JSON blob of the data needed to COMPLETE the flow once the code is
   * verified — e.g. the pending signup's name + password hash, or the Google
   * provider id. Kept server-side only; never returned to the client.
   */
  @Column({ name: 'payload', type: 'text', nullable: true, default: null })
  payload: string | null;

  /** Number of failed verification attempts so far. */
  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;

  /** When the code stops being valid. */
  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  /** Set once when the code is successfully used — makes it single-use. */
  @Column({ name: 'consumed_at', type: 'datetime', nullable: true, default: null })
  consumedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
