import { ProvisioningWorker } from '../services/provisioning.worker';
import {
  ProvisioningAction,
  ProvisioningStatus,
  TenantStatus,
} from '../../../common/enums';

function makeRepo<T extends { id?: string }>(seed: T[] = []) {
  const store: T[] = [...seed];
  const match = (r: any, where: any) =>
    Object.entries(where).every(([k, v]) => r[k] === v);
  return {
    store,
    findOne: jest.fn(async ({ where }: any) => store.find((r) => match(r, where)) ?? null),
    find: jest.fn(async ({ where }: any = {}) =>
      where ? store.filter((r) => match(r, where)) : [...store],
    ),
    save: jest.fn(async (row: T) => row),
  };
}

const cfg = { get: () => ({ maxAttempts: 3, workerIntervalMs: 5000 }) } as any;

function setup(provisionResult: any) {
  const job = {
    id: 'job-1',
    tenantId: 't1',
    action: ProvisioningAction.PROVISION,
    status: ProvisioningStatus.QUEUED,
    requestId: 'req-1',
    attempts: 0,
    startedAt: null,
  };
  const tenant = { id: 't1', productId: 'prod-1', slug: 'acme', status: TenantStatus.PENDING };
  const product = { id: 'prod-1', code: 'mudar', provisioner: 'mock' };

  const logRepo = makeRepo<any>([job]);
  const tenantRepo = makeRepo<any>([tenant]);
  const productRepo = makeRepo<any>([product]);
  const subRepo = makeRepo<any>([{ id: 's1', tenantId: 't1', planId: 'plan-1' }]);
  const planRepo = makeRepo<any>([{ id: 'plan-1', productId: 'prod-1' }]);

  const provisioner = {
    key: 'mock',
    provision: jest.fn(async () => provisionResult),
    suspend: jest.fn(),
    reactivate: jest.fn(),
    updatePlan: jest.fn(),
    updateLimits: jest.fn(),
    archive: jest.fn(),
  };
  const registry = { forProduct: jest.fn(() => provisioner) } as any;

  const tenantsService = {
    markProvisioning: jest.fn(async () => {
      tenant.status = TenantStatus.PROVISIONING;
    }),
    applySuccess: jest.fn(async () => {
      tenant.status = TenantStatus.ACTIVE;
    }),
    applyFailure: jest.fn(async () => {
      tenant.status = TenantStatus.FAILED;
    }),
  } as any;

  const worker = new ProvisioningWorker(
    cfg,
    logRepo as any,
    tenantRepo as any,
    productRepo as any,
    subRepo as any,
    planRepo as any,
    tenantsService,
    registry,
  );

  return { worker, job, tenant, logRepo, provisioner, tenantsService };
}

describe('ProvisioningWorker.runJob', () => {
  it('claims QUEUED → RUNNING, increments attempts, and applies success', async () => {
    const { worker, job, tenantsService } = setup({
      ok: true,
      externalTenantId: 'ext-1',
      metadata: { a: 1 },
    });

    await worker.runJob('job-1');

    expect(job.attempts).toBe(1);
    expect(job.status).toBe(ProvisioningStatus.SUCCEEDED);
    expect(tenantsService.markProvisioning).toHaveBeenCalled();
    expect(tenantsService.applySuccess).toHaveBeenCalledWith(
      expect.anything(),
      ProvisioningAction.PROVISION,
      'ext-1',
      { a: 1 },
    );
  });

  it('re-QUEUEs with the SAME requestId on transient failure (retry, not FAILED)', async () => {
    const { worker, job, tenantsService } = setup({ ok: false, error: 'temporary' });

    await worker.runJob('job-1');

    expect(job.attempts).toBe(1);
    expect(job.status).toBe(ProvisioningStatus.QUEUED); // retry
    expect(job.requestId).toBe('req-1'); // idempotency key preserved
    expect(tenantsService.applyFailure).not.toHaveBeenCalled();
  });

  it('marks FAILED after exhausting maxAttempts', async () => {
    const { worker, job, tenantsService } = setup({ ok: false, error: 'boom' });
    job.attempts = 2; // next attempt is the 3rd (== maxAttempts)

    await worker.runJob('job-1');

    expect(job.attempts).toBe(3);
    expect(job.status).toBe(ProvisioningStatus.FAILED);
    expect(tenantsService.applyFailure).toHaveBeenCalled();
  });

  it('is a no-op for a job that is not QUEUED (no double-run)', async () => {
    const { worker, job, provisioner } = setup({ ok: true });
    job.status = ProvisioningStatus.RUNNING;
    await worker.runJob('job-1');
    expect(provisioner.provision).not.toHaveBeenCalled();
  });
});
