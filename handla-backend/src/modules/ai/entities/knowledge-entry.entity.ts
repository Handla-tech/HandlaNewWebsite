import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { KnowledgeCategory } from '../../../common/enums';

/**
 * A single curated fact the Handla AI assistant is allowed to speak from.
 *
 * The assistant answers ONLY from ACTIVE knowledge entries — this table is the
 * single source of truth for the "no hallucination" policy. If a fact is not
 * here, the bot must say it does not know and offer a human.
 */
@Index('idx_kb_active_category', ['isActive', 'category'])
@Entity('ai_knowledge_entries')
export class KnowledgeEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Short human-readable title / question this entry answers. */
  @Column({ type: 'varchar', length: 255 })
  title: string;

  /** The authoritative answer/body. The AI must not go beyond this. */
  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: KnowledgeCategory,
    default: KnowledgeCategory.OTHER,
  })
  category: KnowledgeCategory;

  /**
   * Comma-separated keywords/tags used by the lightweight lexical retriever to
   * bias relevance (no vector DB dependency required).
   */
  @Column({ type: 'varchar', length: 512, nullable: true, default: null })
  tags: string | null;

  /** Higher priority entries win ties in retrieval and are preferred. */
  @Column({ type: 'int', default: 0 })
  priority: number;

  /** Inactive entries are invisible to the assistant (soft toggle). */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Optional: which product this fact relates to (mudar/matjari/manara). */
  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  product: string | null;

  /** User id (ADMIN/EMPLOYEE) who authored/last edited the entry. */
  @Column({ name: 'author_id', type: 'varchar', length: 36, nullable: true, default: null })
  authorId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
