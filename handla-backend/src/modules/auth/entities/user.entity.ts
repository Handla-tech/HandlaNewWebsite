import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserRole } from '../../../common/enums';

// Non-unique covering index on email — added by migration 1716825600000-InitialSchema.
// Declared as @Index so synchronize:true does NOT drop it (harmless for email since
// it has no FK constraint, but declaring it prevents unnecessary ALTER TABLE noise).
@Index('idx_users_email', ['email'])
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

 
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.LEAD,
  })
  role: UserRole;

  // ─── Profile fields (added 2026-06 via AddProfileFieldsToUsers migration) ──
  //
  // All optional — pre-existing users have NULL until they fill out their
  // profile. avatarUrl points to an S3 object uploaded via the Profiles
  // module presigned-URL flow.

  /** Public profile picture URL (S3) — used for chat avatars, user lists, etc. */
  @Column({ name: 'avatar_url', type: 'varchar', length: 2048, nullable: true, default: null })
  avatarUrl: string | null;

  /** Short bio shown on the user's profile page (max 500 chars). */
  @Column({ name: 'bio', type: 'varchar', length: 500, nullable: true, default: null })
  bio: string | null;

  /** Contact phone number (free-form, not validated server-side for now). */
  @Column({ name: 'phone_number', type: 'varchar', length: 32, nullable: true, default: null })
  phoneNumber: string | null;

  /** Job title — useful for EMPLOYEE / ADMIN profiles displayed in chat. */
  @Column({ name: 'job_title', type: 'varchar', length: 120, nullable: true, default: null })
  jobTitle: string | null;

  /** Company / organisation name (shown on CLIENT profiles primarily). */
  @Column({ name: 'company', type: 'varchar', length: 120, nullable: true, default: null })
  company: string | null;

  /** Free-form location string (city, country, etc.). */
  @Column({ name: 'location', type: 'varchar', length: 120, nullable: true, default: null })
  location: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  /**
   * Soft-archive flag.  When true the user row is hidden from all normal
   * queries but all related records (invoices, projects, clients, etc.)
   * remain intact and are accessible through the admin archive view.
   */
  @Column({ name: 'is_archived', type: 'boolean', default: false })
  isArchived: boolean;

  /** Timestamp set once when the user is first archived. */
  @Column({ name: 'archived_at', type: 'datetime', nullable: true, default: null })
  archivedAt: Date | null;

  /**
   * Disabled flag.  When true the user cannot sign in.
   * The account (and all its records) stays in the system — only login is blocked.
   */
  @Column({ name: 'is_disabled', type: 'boolean', default: false })
  isDisabled: boolean;

  // ─── Relations (defined here for TypeORM awareness, actual FK on other side) ──
  // Lazy imports via string names to avoid circular dependency
  @OneToMany('Conversation', 'admin')
  adminConversations: any[];

  @OneToMany('Conversation', 'client')
  clientConversations: any[];

  /** Conversations where this EMPLOYEE user is the assigned handler. */
  @OneToMany('Conversation', 'assignedEmployee')
  assignedConversations: any[];

  @OneToMany('Message', 'sender')
  messages: any[];

  @OneToMany('Notification', 'user')
  notifications: any[];

  @OneToMany('Testimonial', 'createdByAdmin')
  testimonials: any[];
}
