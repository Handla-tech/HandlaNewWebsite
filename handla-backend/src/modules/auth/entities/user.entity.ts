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
