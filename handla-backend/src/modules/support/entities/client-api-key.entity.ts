import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * SUP-2 — ClientApiKey entity.
 *
 * A per-client secret that lets an external platform open (and reply to)
 * support tickets programmatically via the /api/support ingest endpoints.
 *
 * Security model:
 *   - The full key is shown ONLY ONCE at creation time (returned by the
 *     service, never persisted in plaintext).
 *   - We store a SHA-256 `keyHash` for lookup + a `prefix` (first 12 chars)
 *     for display in the UI ("hk_live_ab12…").
 *   - `isActive` allows revocation without deleting audit history.
 */
@Entity('client_api_keys')
export class ClientApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── FK: Client (CASCADE) ──────────────────────────────────────────────────
  @Column({ name: 'client_id', type: 'varchar', length: 36 })
  @Index('idx_client_api_keys_client_id')
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  /** SHA-256 hex digest of the full key — unique, used for O(1) lookup. */
  @Column({ name: 'key_hash', type: 'varchar', length: 64, unique: true })
  @Index('idx_client_api_keys_hash')
  keyHash: string;

  /** First 12 chars of the key for display, e.g. "hk_live_ab12". */
  @Column({ type: 'varchar', length: 20 })
  prefix: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt: Date | null;

  // ─── FK: creator (staff) ───────────────────────────────────────────────────
  @Column({ name: 'created_by', type: 'varchar', length: 36, nullable: true })
  createdBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
