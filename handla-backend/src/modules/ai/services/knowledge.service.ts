import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { KnowledgeEntry } from '../entities/knowledge-entry.entity';
import {
  CreateKnowledgeDto,
  UpdateKnowledgeDto,
  KnowledgeQueryDto,
} from '../dto/knowledge.dto';

/**
 * Manages the AI Knowledge Base — the ONLY source of facts the assistant is
 * allowed to speak from. Provides admin CRUD plus a lightweight, dependency-free
 * lexical retriever used to build the grounding context for each reply.
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectRepository(KnowledgeEntry)
    private readonly kbRepo: Repository<KnowledgeEntry>,
  ) {}

  // ─── Admin CRUD ─────────────────────────────────────────────────────────────

  async create(dto: CreateKnowledgeDto, authorId?: string): Promise<KnowledgeEntry> {
    const entry = this.kbRepo.create({
      title: dto.title,
      content: dto.content,
      category: dto.category,
      tags: dto.tags ?? null,
      priority: dto.priority ?? 0,
      isActive: dto.isActive ?? true,
      product: dto.product ?? null,
      authorId: authorId ?? null,
    });
    return this.kbRepo.save(entry);
  }

  async findAll(query: KnowledgeQueryDto = {}) {
    const { page = 1, limit = 20, category, search, isActive } = query;
    const skip = (page - 1) * limit;

    const qb = this.kbRepo
      .createQueryBuilder('kb')
      .orderBy('kb.priority', 'DESC')
      .addOrderBy('kb.updatedAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (category) qb.andWhere('kb.category = :category', { category });
    if (typeof isActive === 'boolean') qb.andWhere('kb.isActive = :isActive', { isActive });
    if (search) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('kb.title LIKE :s', { s: `%${search}%` })
            .orWhere('kb.content LIKE :s', { s: `%${search}%` })
            .orWhere('kb.tags LIKE :s', { s: `%${search}%` });
        }),
      );
    }

    const [entries, total] = await qb.getManyAndCount();
    return { entries, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<KnowledgeEntry> {
    const entry = await this.kbRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Knowledge entry ${id} not found`);
    return entry;
  }

  async update(id: string, dto: UpdateKnowledgeDto): Promise<KnowledgeEntry> {
    const entry = await this.findOne(id);
    Object.assign(entry, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.content !== undefined && { content: dto.content }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.product !== undefined && { product: dto.product }),
    });
    return this.kbRepo.save(entry);
  }

  async remove(id: string): Promise<void> {
    const entry = await this.findOne(id);
    await this.kbRepo.remove(entry);
  }

  // ─── Retrieval (grounding) ──────────────────────────────────────────────────

  /**
   * Lightweight lexical retrieval — no vector DB dependency. Scores each ACTIVE
   * entry against the query terms (title/tags weighted higher than body) and
   * returns the top `limit` snippets, tie-broken by admin-set priority.
   *
   * This is intentionally simple and deterministic: it grounds the model in
   * curated facts. If nothing scores, we still return the highest-priority
   * entries so the bot has *some* company context.
   */
  async retrieve(query: string, limit = 6): Promise<KnowledgeEntry[]> {
    const active = await this.kbRepo.find({
      where: { isActive: true },
      order: { priority: 'DESC', updatedAt: 'DESC' },
    });
    if (active.length === 0) return [];

    const terms = this.tokenize(query);
    if (terms.length === 0) return active.slice(0, limit);

    const scored = active.map((entry) => ({
      entry,
      score: this.score(entry, terms),
    }));

    const hits = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || b.entry.priority - a.entry.priority)
      .slice(0, limit)
      .map((s) => s.entry);

    // Fallback: if the query matched nothing, still ground with top entries.
    if (hits.length === 0) return active.slice(0, Math.min(limit, 3));
    return hits;
  }

  /** Count of active entries — used to decide whether the KB is usable at all. */
  async activeCount(): Promise<number> {
    return this.kbRepo.count({ where: { isActive: true } });
  }

  private tokenize(text: string): string[] {
    return (text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3);
  }

  private score(entry: KnowledgeEntry, terms: string[]): number {
    const title = (entry.title || '').toLowerCase();
    const tags = (entry.tags || '').toLowerCase();
    const body = (entry.content || '').toLowerCase();
    const product = (entry.product || '').toLowerCase();

    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += 5;
      if (tags.includes(t)) score += 4;
      if (product && product.includes(t)) score += 4;
      if (body.includes(t)) score += 1;
    }
    return score;
  }
}
