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
import { ProjectStatus } from '../../../common/enums';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * ERP-4 — Project entity.
 *
 * A Project belongs to exactly one Client and is owned by an EMPLOYEE.
 *
 * Ownership model:
 *   - owner_id references the EMPLOYEE responsible for this project.
 *   - EMPLOYEE can only access projects where ownerId === user.id.
 *   - ADMIN bypasses all ownership checks.
 *   - CLIENT (read-only) can access projects linked to their client record.
 */
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ─── FK: parent Client ────────────────────────────────────────────────────────
  @Column({ name: 'client_id', type: 'varchar', length: 36 })
  @Index('idx_projects_client_id')
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE', nullable: false, eager: false })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  // ─── FK: owning EMPLOYEE ──────────────────────────────────────────────────────
  @Column({ name: 'owner_id', type: 'varchar', length: 36, nullable: true })
  @Index('idx_projects_owner_id')
  ownerId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  // ─── Status & dates ───────────────────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.PLANNING,
  })
  @Index('idx_projects_status')
  status: ProjectStatus;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  // ─── Relations (lazy string refs to avoid circular imports) ──────────────────
  /** Tasks belonging to this project. */
  @OneToMany('Task', 'project')
  tasks: any[];
}
