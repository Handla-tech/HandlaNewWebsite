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
import { AccountType } from '../../../common/enums';

/**
 * ACC-1 — Account (Chart of Accounts) entity.
 *
 * A flat/hierarchical list of accounting buckets used to categorise every
 * money movement. Examples:
 *   4000 Sales / Services Income   (INCOME)
 *   5000 Software Subscriptions    (EXPENSE)
 *   5100 Salaries                  (EXPENSE)
 *   1000 Cash / Bank               (ASSET)
 *   1100 Accounts Receivable       (ASSET)
 *   2000 Accounts Payable          (LIABILITY)
 *   2100 Taxes Payable             (LIABILITY)
 *
 * `code` is a short human identifier (unique). `parentId` allows optional
 * sub-accounts (e.g. 5000 → 5010 Hosting).
 */
@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  @Index('idx_accounts_code')
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'enum', enum: AccountType })
  @Index('idx_accounts_type')
  type: AccountType;

  // Optional self-reference for sub-accounts
  @Column({ name: 'parent_id', type: 'varchar', length: 36, nullable: true })
  parentId: string | null;

  @ManyToOne(() => Account, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Account | null;

  // Optional default currency for the account (reports group by currency anyway)
  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // System accounts are seeded and cannot be deleted through the API
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
