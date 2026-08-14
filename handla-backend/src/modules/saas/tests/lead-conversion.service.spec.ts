import { LeadConversionService } from '../services/lead-conversion.service';
import { UserRole, LeadStatus, ClientStatus } from '../../../common/enums';

function makeRepo<T extends { id?: string }>(seed: T[] = []) {
  const store: T[] = [...seed];
  let seq = 0;
  const match = (r: any, where: any) =>
    Object.entries(where).every(([k, v]) => r[k] === v);
  return {
    store,
    findOne: jest.fn(async ({ where }: any) => store.find((r) => match(r, where)) ?? null),
    create: jest.fn((p: Partial<T>) => ({ ...p } as T)),
    save: jest.fn(async (row: T) => {
      if (!row.id) {
        row.id = `id-${++seq}`;
        store.push(row);
      }
      return row;
    }),
  };
}

function setup(opts: { leadStatus?: LeadStatus; role?: UserRole } = {}) {
  const clientRepo = makeRepo<any>();
  const userRepo = makeRepo<any>([
    { id: 'user-1', name: 'Jane', role: opts.role ?? UserRole.LEAD, company: null, phoneNumber: null },
  ]);
  const convRepo = makeRepo<any>([
    { id: 'conv-1', clientId: 'user-1', assignedEmployeeId: 'emp-1' },
  ]);
  const stateRepo = makeRepo<any>([
    {
      id: 'state-1',
      conversationId: 'conv-1',
      leadStatus: opts.leadStatus ?? LeadStatus.QUALIFIED,
      leadData: { company: 'Acme Corp', phone: '+123', name: 'Jane' },
    },
  ]);
  const tenant = { id: 'tenant-1', slug: 'acme-corp' };
  const tenantsService = { create: jest.fn(async () => tenant) } as any;

  const svc = new LeadConversionService(
    clientRepo as any,
    userRepo as any,
    convRepo as any,
    stateRepo as any,
    tenantsService,
  );
  return { svc, clientRepo, userRepo, convRepo, stateRepo, tenantsService, tenant };
}

describe('LeadConversionService (Lead → Client → Tenant)', () => {
  it('promotes a QUALIFIED lead: LEAD→CLIENT, creates Client, marks CONVERTED, provisions tenant', async () => {
    const { svc, clientRepo, userRepo, stateRepo, tenantsService } = setup();

    const res = await svc.convert(
      { conversationId: 'conv-1', productId: 'prod-1', planId: 'plan-1' } as any,
      'admin-1',
    );

    expect(res.promoted).toBe(true);
    expect(userRepo.store[0].role).toBe(UserRole.CLIENT);
    expect(userRepo.store[0].company).toBe('Acme Corp'); // enriched from lead data
    expect(clientRepo.store[0].userId).toBe('user-1');
    expect(clientRepo.store[0].ownerId).toBe('emp-1'); // carried from assigned employee
    expect(clientRepo.store[0].status).toBe(ClientStatus.ACTIVE);
    expect(stateRepo.store[0].leadStatus).toBe(LeadStatus.CONVERTED);

    expect(tenantsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: clientRepo.store[0].id, name: 'Acme Corp' }),
      'admin-1',
    );
    expect(res.tenant.id).toBe('tenant-1');
  });

  it('refuses to convert a lead that is not QUALIFIED', async () => {
    const { svc } = setup({ leadStatus: LeadStatus.QUALIFYING });
    await expect(
      svc.convert(
        { conversationId: 'conv-1', productId: 'prod-1', planId: 'plan-1' } as any,
        'admin-1',
      ),
    ).rejects.toThrow();
  });

  it('mode B: uses an existing client without promotion', async () => {
    const { svc, clientRepo, tenantsService } = setup();
    clientRepo.store.push({ id: 'client-9', company: 'Existing Co', userId: 'u9' });

    const res = await svc.convert(
      { clientId: 'client-9', productId: 'prod-1', planId: 'plan-1' } as any,
      'admin-1',
    );

    expect(res.promoted).toBe(false);
    expect(tenantsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-9', name: 'Existing Co' }),
      'admin-1',
    );
  });

  it('requires either clientId or conversationId', async () => {
    const { svc } = setup();
    await expect(
      svc.convert({ productId: 'p', planId: 'pl' } as any, 'admin-1'),
    ).rejects.toThrow();
  });
});
