import { KnowledgeService } from '../services/knowledge.service';
import { KnowledgeEntry } from '../entities/knowledge-entry.entity';
import { KnowledgeCategory } from '../../../common/enums';

function entry(partial: Partial<KnowledgeEntry>): KnowledgeEntry {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'title',
    content: 'content',
    category: KnowledgeCategory.OTHER,
    tags: null,
    priority: 0,
    isActive: true,
    product: null,
    authorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe('KnowledgeService.retrieve (lexical grounding)', () => {
  function makeService(entries: KnowledgeEntry[]) {
    const repo = {
      find: jest.fn(async () => entries.filter((e) => e.isActive)),
      count: jest.fn(async () => entries.filter((e) => e.isActive).length),
    };
    return new KnowledgeService(repo as any);
  }

  it('returns [] when the KB is empty', async () => {
    const svc = makeService([]);
    expect(await svc.retrieve('anything', 5)).toEqual([]);
  });

  it('ranks title/tag matches above body matches', async () => {
    const svc = makeService([
      entry({ title: 'Matjari pricing', content: 'general' }),
      entry({ title: 'Company', content: 'we mention matjari once deep in the body' }),
    ]);
    const hits = await svc.retrieve('matjari', 5);
    expect(hits[0].title).toBe('Matjari pricing');
  });

  it('falls back to top entries when nothing matches the query', async () => {
    const svc = makeService([
      entry({ title: 'A', priority: 10 }),
      entry({ title: 'B', priority: 1 }),
    ]);
    const hits = await svc.retrieve('zzz-nomatch-term', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].title).toBe('A'); // highest priority first
  });

  it('ignores inactive entries', async () => {
    const svc = makeService([
      entry({ title: 'Active Matjari', isActive: true }),
      entry({ title: 'Inactive Matjari', isActive: false }),
    ]);
    const hits = await svc.retrieve('matjari', 5);
    expect(hits.every((h) => h.isActive)).toBe(true);
  });
});
