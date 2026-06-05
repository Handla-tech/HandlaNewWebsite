import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { ConversationStatus } from '../../../common/enums';
import { User } from '../../auth/entities/user.entity';

// UNIQUE index on (client_id, admin_id) — added by migration
// 1748800000000-DeduplicateConversationsUniqueConstraint after deduplication.
// Declared as @Index here (not @Unique) so that:
//   1. synchronize:true does NOT try to drop it (entity and DB stay in sync).
//   2. synchronize:true does NOT re-run the ADD CONSTRAINT before the migration
//      dedup step, which would fail on pre-existing duplicate rows.
// The { unique: true } flag tells TypeORM the index exists but it must NOT
// attempt to drop-and-recreate it when duplicate rows are present at startup.
@Index('uq_conversations_client_admin', ['clientId', 'adminId'], { unique: true })
// Index on assigned_employee_id — added by migration
// 1748650001000-AddAssignedEmployeeToConversations. Declared as @Index so that
// synchronize:true does NOT try to drop it (which MySQL blocks because the index
// backs the assigned_employee_id FK constraint).
@Index('idx_conversations_assigned_employee', ['assignedEmployeeId'])
@Index('idx_conversation_admin_client_status', ['adminId', 'clientId', 'status'])
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'admin_id', type: 'varchar', length: 36 })
  adminId: string;

  @Column({ name: 'client_id', type: 'varchar', length: 36 })
  clientId: string;

  /**
   * The EMPLOYEE assigned to handle this conversation on behalf of admin.
   * Nullable — unassigned conversations are visible only to ADMIN.
   * Set via migration 1748650001000-AddAssignedEmployeeToConversations.
   */
  @Column({ name: 'assigned_employee_id', type: 'varchar', length: 36, nullable: true, default: null })
  assignedEmployeeId: string | null;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.ACTIVE,
  })
  status: ConversationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  // ─── Relations ────────────────────────────────────────────────────────────────
  @ManyToOne(() => User, (user) => user.adminConversations, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'admin_id' })
  admin: User;

  @ManyToOne(() => User, (user) => user.clientConversations, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'client_id' })
  client: User;

  /**
   * The EMPLOYEE user assigned to this conversation.
   * ON DELETE SET NULL — removing an employee does not destroy the conversation.
   */
  @ManyToOne(() => User, (user) => user.assignedConversations, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'assigned_employee_id' })
  assignedEmployee: User | null;

  @OneToMany('Message', 'conversation', { cascade: true })
  messages: any[];
}
