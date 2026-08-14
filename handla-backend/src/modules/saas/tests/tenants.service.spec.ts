import { TenantsService } from '../services/tenants.service';
import {
  TenantStatus,
  SubscriptionStatus,
  ProvisioningAction,
  ProvisioningStatus,
} from '../../../common/enums';

/** In-memory repo double. */
function makeRepo<T extends { id?: string }>(seed: T[] = []) {
  const store: T[] = [...seed];
  let seq = 0;
  const match = (r: any, where: any) =>
    Object.entries(where).every(([k, v]) => r[k] === v);
  return {
    store,
    findOne: jest.fn(async ({ where }: any) => store.find((r) => match(r, where)) ?? null),
    find: jest.fn(async ({ where }: any = {}) =>
      where ? store.filter((r) => match(r, where)) : [...store],
    ),
    create: jest.fn((p: Partial<T>) => ({ ...p } as T)),
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
    createQueryBuilder: jest.fn(),
  };
}

const cfg = {
  get: () => ({ rootZone: 'handla.tech', maxAttempts: 3 }),
} as any;

function setup() {
  const tenantRepo = makeRepo<any>();
  const subRepo = makeRepo<any>();
  const domainRepo = makeRepo<any>();
  const logRepo = makeRepo<any>();
  const productRepo = makeRepo<any>([
    { id: 'prod-1', code: 'mudar', isActive: true, subdomainZone: 'mudar.handla.tech' },
  ]);
  const planRepo = makeRepo<any>([
    { id: 'plan-1', productId: 'prod-1', trialDays: 14 },
  ]);
  const clientRepo = makeRepo<any>([{ id: 'client-1' }]);

  const svc = new TenantsService(
    cfg,
    tenantRepo as any,
    subRepo as any,
    domainRepo as any,
    logRepo as any,
    productRepo as any,
    planRepo as any,
    clientRepo as any,
  );
  // Bypass the relations-loading findOne for assertions.
  jest.spyOn(svc, 'findOne').mockImplementation(async (id: string) => {
    return tenantRepo.store.find((t) => t.id === id);
  });
  return { svc, tenantRepo, subRepo, domainRepo, logRepo, productRepo, planRepo, clientRepo };
}

describe('TenantsService.create', () => {
  it('creates a PENDING tenant, primary domain, TRIAL subscription and a QUEUED PROVISION job', async () => {
    const { svc, tenantRepo, subRepo, domainRepo, logRepo } = setup();

    await svc.create(
      { clientId: 'client-1', productId: 'prod-1', planId: 'plan-1', name: 'Acme Co' } as any,
      'admin-1',
    );

    const tenant = tenantRepo.store[0];
    expect(tenant.status).toBe(TenantStatus.PENDING);
    expect(tenant.slug).toBe('acme-co');

    expect(domainRepo.store[0].domain).toBe('acme-co.mudar.handla.tech');
    expect(domainRepo.store[0].isPrimary).toBe(true);

    expect(subRepo.store[0].status).toBe(SubscriptionStatus.TRIAL);

    expect(logRepo.store).toHaveLength(1);
    expect(logRepo.store[0].action).toBe(ProvisioningAction.PROVISION);
    expect(logRepo.store[0].status).toBe(ProvisioningStatus.QUEUED);
    expect(logRepo.store[0].requestId).toBeTruthy();
  });

  it('rejects a plan that belongs to another product', async () => {
    const { svc, planRepo } = setup();
    planRepo.store.push({ id: 'plan-x', productId: 'other', trialDays: 0 });
    await expect(
      svc.create(
        { clientId: 'client-1', productId: 'prod-1', planId: 'plan-x', name: 'X' } as any,
        'admin-1',
      ),
    ).rejects.toThrow();
  });

  it('rejects a missing client', async () => {
    const { svc } = setup();
    await expect(
      svc.create(
        { clientId: 'ghost', productId: 'prod-1', planId: 'plan-1', name: 'X' } as any,
        'admin-1',
      ),
    ).rejects.toThrow();
  });
});

describe('TenantsService lifecycle enqueue', () => {
  it('suspend enqueues a SUSPEND job only from ACTIVE', async () => {
    const { svc, tenantRepo, logRepo } = setup();
    tenantRepo.store.push({ id: 't1', productId: 'prod-1', status: TenantStatus.ACTIVE });

    await svc.suspend('t1', 'admin-1');
    expect(logRepo.store.some((l) => l.action === ProvisioningAction.SUSPEND)).toBe(true);
  });

  it('suspend is rejected from PENDING (illegal transition)', async () => {
    const { svc, tenantRepo } = setup();
    tenantRepo.store.push({ id: 't2', productId: 'prod-1', status: TenantStatus.PENDING });
    await expect(svc.suspend('t2', 'admin-1')).rejects.toThrow();
  });

  it('retry only allowed from FAILED', async () => {
    const { svc, tenantRepo, logRepo } = setup();
    tenantRepo.store.push({ id: 't3', productId: 'prod-1', status: TenantStatus.FAILED });
    await svc.retry('t3', 'admin-1');
    expect(logRepo.store.some((l) => l.action === ProvisioningAction.PROVISION)).toBe(true);

    tenantRepo.store.push({ id: 't4', productId: 'prod-1', status: TenantStatus.ACTIVE });
    await expect(svc.retry('t4', 'admin-1')).rejects.toThrow();
  });
});

describe('TenantsService.handleCallback (idempotency + state application)', () => {
  it('applies success from a product callback keyed by requestId', async () => {
    const { svc, tenantRepo, logRepo } = setup();
    const tenant = { id: 't1', productId: 'prod-1', status: TenantStatus.PROVISIONING };
    tenantRepo.store.push(tenant);
    logRepo.store.push({
      id: 'log-1',
      tenantId: 't1',
      action: ProvisioningAction.PROVISION,
      status: ProvisioningStatus.RUNNING,
      requestId: 'req-abc',
    });

    await svc.handleCallback({
      requestId: 'req-abc',
      status: 'succeeded',
      externalTenantId: 'ext-999',
      metadata: { region: 'eu' },
    } as any);

    expect(tenant.status).toBe(TenantStatus.ACTIVE);
    expect((tenant as any).externalTenantId).toBe('ext-999');
    expect(logRepo.store[0].status).toBe(ProvisioningStatus.SUCCEEDED);
  });

  it('applies failure and marks the tenant FAILED', async () => {
    const { svc, tenantRepo, logRepo } = setup();
    const tenant = { id: 't2', productId: 'prod-1', status: TenantStatus.PROVISIONING };
    tenantRepo.store.push(tenant);
    logRepo.store.push({
      id: 'log-2',
      tenantId: 't2',
      action: ProvisioningAction.PROVISION,
      status: ProvisioningStatus.RUNNING,
      requestId: 'req-def',
    });

    await svc.handleCallback({ requestId: 'req-def', status: 'failed', error: 'boom' } as any);

    expect(tenant.status).toBe(TenantStatus.FAILED);
    expect((tenant as any).lastError).toBe('boom');
    expect(logRepo.store[0].status).toBe(ProvisioningStatus.FAILED);
  });

  it('rejects a callback for an unknown requestId', async () => {
    const { svc } = setup();
    await expect(
      svc.handleCallback({ requestId: 'ghost', status: 'succeeded' } as any),
    ).rejects.toThrow();
  });
});
