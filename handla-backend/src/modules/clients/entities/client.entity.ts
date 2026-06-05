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
import { ClientStatus } from '../../../common/enums';
import { User } from '../../auth/entities/user.entity';

/**
 * ERP-3 — Client entity.
 *
 * A Client record wraps a User (role=CLIENT) with ERP metadata.
 * One User can have at most one Client record (UNIQUE user_id).
 *
 * Ownership model:
 *   - owner_id references the EMPLOYEE responsible for this client.
 *   - EMPLOYEE can only access clients where ownerId === user.id.
 *   - ADMIN bypasses all ownership checks.
 */
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── FK: the User (role=CLIENT) this record represents ──────────────────────
  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  @Index({ unique: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false, eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ─── FK: the EMPLOYEE who owns/manages this client ───────────────────────────
  @Column({ name: 'owner_id', type: 'varchar', length: 36, nullable: true })
  @Index('idx_clients_owner_id')
  ownerId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  // ─── ERP metadata ─────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 255, nullable: true })
  company: string | null;

  @Column({
    type: 'enum',
    enum: ClientStatus,
    default: ClientStatus.ACTIVE,
  })
  @Index('idx_clients_status')
  status: ClientStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  // ─── Relations (lazy string refs to avoid circular imports) ──────────────────
  /** Projects belonging to this client. */
  @OneToMany('Project', 'client')
  projects: any[];

  /** Contracts issued to this client. */
  @OneToMany('Contract', 'client')
  contracts: any[];

  /** Invoices raised against this client. */
  @OneToMany('Invoice', 'client')
  invoices: any[];
}
