import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { NotificationType } from '../../../common/enums';
import { User } from '../../auth/entities/user.entity';

@Index('idx_notification_user_read_created', ['userId', 'isRead', 'createdAt'])
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.MESSAGE,
  })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'related_message_id', type: 'varchar', length: 36, nullable: true })
  relatedMessageId: string | null;

  /** ERP-9: UUID of the related ERP entity (contract / invoice / task / client) */
  @Column({ name: 'related_entity_id', type: 'varchar', length: 36, nullable: true })
  relatedEntityId: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  // ─── Relations ────────────────────────────────────────────────────────────────
  @ManyToOne(() => User, (user) => user.notifications, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
