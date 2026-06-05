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

@Index('idx_testimonial_created_at', ['createdAt'])
@Entity('testimonials')
export class Testimonial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_name', type: 'varchar', length: 100 })
  clientName: string;

  @Column({ name: 'client_company', type: 'varchar', length: 150, nullable: true })
  clientCompany: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'image_url', type: 'varchar', length: 2048, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ name: 'created_by_admin_id', type: 'varchar', length: 36, nullable: true })
  createdByAdminId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  // ─── Relations ────────────────────────────────────────────────────────────────
  @ManyToOne(() => User, (user) => user.testimonials, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'created_by_admin_id' })
  createdByAdmin: User;
}
