import { createHash } from 'crypto';
import { ProductsService } from '../services/products.service';
import { PlansService } from '../services/plans.service';

/** Tiny in-memory repository double covering the methods the services use. */
function makeRepo<T extends { id?: string }>() {
  const store: T[] = [];
  let seq = 0;
  return {
    store,
    findOne: jest.fn(async ({ where }: any) => {
      return (
        store.find((r) =>
          Object.entries(where).every(([k, v]) => (r as any)[k] === v),
        ) ?? null
      );
    }),
    find: jest.fn(async ({ where }: any = {}) => {
      if (!where) return [...store];
      return store.filter((r) =>
        Object.entries(where).every(([k, v]) => (r as any)[k] === v),
      );
    }),
    create: jest.fn((partial: Partial<T>) => ({ ...partial } as T)),
    save: jest.fn(async (row: T) => {
      if (!row.id) {
        row.id = `id-${++seq}`;
        store.push(row);
      } else {
        const i = store.findIndex((r) => r.id === row.id);
        if (i >= 0) store[i] = row;
        else store.push(row);
      }
      return row;
    }),
    remove: jest.fn(async (row: T) => {
      const i = store.findIndex((r) => r.id === row.id);
      if (i >= 0) store.splice(i, 1);
      return row;
    }),
  };
}

describe('ProductsService', () => {
  it('creates a product and stores only a SHA-256 hash of the outbound key', async () => {
    const repo = makeRepo<any>();
    const svc = new ProductsService(repo as any);

    const product = await svc.create({
      code: 'mudar',
      name: 'Mudar',
      provisioningKey: 'super-secret',
    } as any);

    expect(product.code).toBe('mudar');
    expect(product.provisioner).toBe('http'); // default
    expect(product.provisioningKeyHash).toBe(
      createHash('sha256').update('super-secret').digest('hex'),
    );
    // plaintext never persisted
    expect(JSON.stringify(product)).not.toContain('super-secret');
  });

  it('rejects a duplicate product code', async () => {
    const repo = makeRepo<any>();
    const svc = new ProductsService(repo as any);
    await svc.create({ code: 'mudar', name: 'Mudar' } as any);
    await expect(svc.create({ code: 'mudar', name: 'Dup' } as any)).rejects.toThrow();
  });

  it('throws NotFound for a missing product', async () => {
    const repo = makeRepo<any>();
    const svc = new ProductsService(repo as any);
    await expect(svc.findOne('nope')).rejects.toThrow();
  });
});

describe('PlansService', () => {
  it('creates a plan scoped to a product', async () => {
    const productRepo = makeRepo<any>();
    const planRepo = makeRepo<any>();
    const product = { id: 'prod-1', code: 'mudar' };
    productRepo.store.push(product);

    const svc = new PlansService(planRepo as any, productRepo as any);
    const plan = await svc.create('prod-1', {
      code: 'starter',
      name: 'Starter',
      trialDays: 14,
      limits: { seats: 5 },
    } as any);

    expect(plan.productId).toBe('prod-1');
    expect(plan.trialDays).toBe(14);
    expect(plan.limits).toEqual({ seats: 5 });
  });

  it('rejects a duplicate (product, code)', async () => {
    const productRepo = makeRepo<any>();
    const planRepo = makeRepo<any>();
    productRepo.store.push({ id: 'prod-1', code: 'mudar' });
    const svc = new PlansService(planRepo as any, productRepo as any);
    await svc.create('prod-1', { code: 'starter', name: 'S' } as any);
    await expect(
      svc.create('prod-1', { code: 'starter', name: 'Dup' } as any),
    ).rejects.toThrow();
  });

  it('rejects a plan for a missing product', async () => {
    const productRepo = makeRepo<any>();
    const planRepo = makeRepo<any>();
    const svc = new PlansService(planRepo as any, productRepo as any);
    await expect(
      svc.create('ghost', { code: 'starter', name: 'S' } as any),
    ).rejects.toThrow();
  });
});
