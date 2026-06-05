import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TaskStatus } from '../../../common/enums';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * ERP-5 — Task entity.
 *
 * A Task belongs to exactly one Project (CASCADE on delete).
 *
 * Two distinct user references:
 *  - owner_id:    EMPLOYEE who created/owns the task — controls access (ownerId === user.id).
 *  - assignee_id: EMPLOYEE assigned to work on it — informational only, does NOT change
 *                 access permissions. An EMPLOYEE can see a task if they own OR are assigned.
 *
 * Delayed status:
 *   Status is NOT computed by a DB trigger. Instead, TasksScheduler calls
 *   recalculateDelayedStatus() every midnight via a manual setInterval-based scheduler
 *   (since @nestjs/schedule is not in package.json). This approach keeps the notification
 *   logic in the service layer and avoids a new library dependency.
 */
// Composite index on (status, due_date) — added by migration 1716825600000-InitialSchema.
// Declared as class-level @Index so synchronize:true does NOT try to drop it.
@Index('idx_tasks_status_due', ['status', 'dueDate'])
@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ─── FK: parent Project ───────────────────────────────────────────────────────
  @Column({ name: 'project_id', type: 'varchar', length: 36 })
  @Index('idx_tasks_project_id')
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: false, eager: false })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  // ─── FK: assignee EMPLOYEE (informational) ────────────────────────────────────
  @Column({ name: 'assignee_id', type: 'varchar', length: 36, nullable: true })
  @Index('idx_tasks_assignee_id')
  assigneeId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'assignee_id' })
  assignee: User | null;

  // ─── FK: owning EMPLOYEE ──────────────────────────────────────────────────────
  @Column({ name: 'owner_id', type: 'varchar', length: 36, nullable: true })
  @Index('idx_tasks_owner_id')
  ownerId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  // ─── Status & dates ───────────────────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
