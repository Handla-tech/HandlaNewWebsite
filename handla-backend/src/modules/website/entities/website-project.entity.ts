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
 * WebsiteProject — a showcase / portfolio project displayed on the PUBLIC
 * marketing website (landing "Projects" section + /projects page).
 *
 * ⚠️  This is completely SEPARATE from the ERP `Project` entity
 * (modules/projects). ERP projects are internal client-delivery records;
 * website projects are marketing content managed by admins.
 */
@Index('idx_website_project_featured', ['featured'])
@Index('idx_website_project_sort_order', ['sortOrder'])
@Entity('website_projects')
export class WebsiteProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Project / case-study title */
  @Column({ type: 'varchar', length: 160 })
  title: string;

  /** Optional client / company the project was delivered for */
  @Column({ name: 'client_name', type: 'varchar', length: 150, nullable: true })
  clientName: string | null;

  /** Short one-line tagline shown on cards */
  @Column({ type: 'varchar', length: 255, nullable: true })
  summary: string | null;

  /** Full rich description (shown on the detail / projects page) */
  @Column({ type: 'text' })
  description: string;

  /** Category / project type label (e.g. "Web App", "ERP", "Mobile") */
  @Column({ type: 'varchar', length: 80, nullable: true })
  category: string | null;

  /** Cover image URL */
  @Column({ name: 'image_url', type: 'varchar', length: 2048, nullable: true })
  imageUrl: string | null;

  /** Optional live/case-study URL */
  @Column({ name: 'project_url', type: 'varchar', length: 2048, nullable: true })
  projectUrl: string | null;

  /** Tech stack / tags, stored as a JSON array of strings */
  @Column({ type: 'json', nullable: true })
  tags: string[] | null;

  /** Whether this project is highlighted in the landing "Featured" section */
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
