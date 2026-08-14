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
import { User } from '../../auth/entities/user.entity';

/**
 * WebsiteProduct — a product / ready-made solution advertised on the PUBLIC
 * marketing website (e.g. "School ERP", "HR & Payroll").
 *
 * Part of the "Website Content" umbrella together with WebsiteProject and
 * the existing Testimonial module. Purely marketing content — unrelated to
 * the SaaS control-plane `SaasProduct` entity.
 */
@Index('idx_website_product_featured', ['featured'])
@Index('idx_website_product_sort_order', ['sortOrder'])
@Entity('website_products')
export class WebsiteProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Product name */
  @Column({ type: 'varchar', length: 160 })
  name: string;

  /** Short one-line tagline */
  @Column({ type: 'varchar', length: 255, nullable: true })
  tagline: string | null;

  /** Full description */
  @Column({ type: 'text' })
  description: string;

  /** Category label (e.g. "ERP", "Mobile App", "Automation") */
  @Column({ type: 'varchar', length: 80, nullable: true })
  category: string | null;

  /** Cover / logo image URL */
  @Column({ name: 'image_url', type: 'varchar', length: 2048, nullable: true })
  imageUrl: string | null;

  /** Optional external / demo URL */
  @Column({ name: 'product_url', type: 'varchar', length: 2048, nullable: true })
  productUrl: string | null;

  /** Optional display price string (e.g. "From $499", "Contact us") */
  @Column({ type: 'varchar', length: 80, nullable: true })
  price: string | null;

  /** Feature bullets, stored as a JSON array of strings */
  @Column({ type: 'json', nullable: true })
  features: string[] | null;

  /** Whether this product is highlighted on the landing page */
  @Column({ type: 'boolean', default: false })
  featured: boolean;

  /** Manual ordering — lower numbers appear first */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'created_by_admin_id', type: 'varchar', length: 36, nullable: true })
  createdByAdminId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  // ─── Relations ────────────────────────────────────────────────────────────────
  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'created_by_admin_id' })
  createdByAdmin: User;
}
