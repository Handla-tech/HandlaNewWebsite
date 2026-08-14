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
import { ProvisioningAction, ProvisioningStatus } from '../../../common/enums';
import { SaasTenant } from './saas-tenant.entity';

/**
 * SAAS-1 — One provisioning job (attempt) against a product adapter.
 *
 * The `requestId` is the IDEMPOTENCY key: a given (tenant, action, requestId)
 * is executed at most once. Retries reuse the same requestId so the product
 * can dedupe on its side too. This table is the audit trail surfaced in the
 * admin "Provisioning Logs" screen.
 */
@Index('idx_saas_prov_logs_tenant', ['tenantId'])
@Index('idx_saas_prov_logs_status', ['status'])
@Index('uq_saas_prov_logs_request', ['requestId'], { unique: true })
@Entity('saas_provisioning_logs')
export class SaasProvisioningLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @ManyToOne(() => SaasTenant, (t) => t.provisioningLogs, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: SaasTenant;

  @Column({ type: 'enum', enum: ProvisioningAction })
  action: ProvisioningAction;

  @Column({ type: 'enum', enum: ProvisioningStatus, default: ProvisioningStatus.QUEUED })
  status: ProvisioningStatus;

  /** Idempotency key (UUID) — unique across all attempts. */
  @Column({ name: 'request_id', type: 'varchar', length: 64 })
  requestId: string;

  /** Number of times this job has been attempted (retry counter). */
  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** Request payload sent to the product (redacted of secrets). */
  @Column({ name: 'request_payload', type: 'json', nullable: true })
  requestPayload: Record<string, unknown> | null;

  /** Raw-ish response captured from the product (for debugging). */
  @Column({ name: 'response_payload', type: 'json', nullable: true })
  responsePayload: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'varchar', length: 1024, nullable: true })
  errorMessage: string | null;

  /** Staff user id who triggered the action (null for system/automatic). */
  @Column({ name: 'triggered_by', type: 'varchar', length: 36, nullable: true })
  triggeredBy: string | null;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
