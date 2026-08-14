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
import { Conversation } from './conversation.entity';
import { MessageOrigin } from '../../../common/enums';

@Index('idx_message_conversation_created', ['conversationId', 'createdAt'])
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'varchar', length: 36 })
  conversationId: string;

  @Column({ name: 'sender_id', type: 'varchar', length: 36 })
  senderId: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ name: 'file_url', type: 'varchar', length: 2048, nullable: true })
  fileUrl: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  /**
   * AI-1: Where this message came from. Additive column — legacy rows and all
   * human-typed messages default to CLIENT/STAFF resolution at read time when
   * null. The AI assistant stamps AI, and takeover notices stamp SYSTEM.
   * Kept nullable so existing chat writes need no change.
   */
  @Column({
    type: 'enum',
    enum: MessageOrigin,
    nullable: true,
    default: null,
  })
  origin: MessageOrigin | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  // ─── Relations ────────────────────────────────────────────────────────────────
  @ManyToOne(() => Conversation, (conv) => conv.messages, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @ManyToOne(() => User, (user) => user.messages, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'sender_id' })
  sender: User;
}
