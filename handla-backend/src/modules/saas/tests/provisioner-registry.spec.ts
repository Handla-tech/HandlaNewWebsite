import { ProvisionerRegistry } from '../provisioners/provisioner.registry';
import { MockProductProvisioner } from '../provisioners/mock-product-provisioner';
import { SaasProduct } from '../entities/saas-product.entity';

/** Minimal ProductProvisioner double keyed 'http'. */
const httpStub = { key: 'http' } as any;

function makeProduct(partial: Partial<SaasProduct>): SaasProduct {
  return { code: 'mudar', provisioner: 'http', ...partial } as SaasProduct;
}

describe('ProvisionerRegistry', () => {
  it('resolves adapters by explicit key', () => {
    const mock = new MockProductProvisioner();
    const reg = new ProvisionerRegistry(httpStub, mock);
    expect(reg.get('http')).toBe(httpStub);
    expect(reg.get('mock')).toBe(mock);
  });

  it('throws for an unknown key', () => {
    const reg = new ProvisionerRegistry(httpStub, new MockProductProvisioner());
    expect(() => reg.get('nope')).toThrow();
  });

  it('forProduct falls back to http when unset', () => {
    const reg = new ProvisionerRegistry(httpStub, new MockProductProvisioner());
    expect(reg.forProduct(makeProduct({ provisioner: null as any }))).toBe(httpStub);
    expect(reg.forProduct(makeProduct({ provisioner: 'mock' })).key).toBe('mock');
  });
});

describe('MockProductProvisioner', () => {
  it('returns a stable external id on provision and ok on lifecycle ops', async () => {
    const mock = new MockProductProvisioner();
    const ctx: any = {
      product: { code: 'mudar' },
      tenant: { slug: 'acme', externalTenantId: null },
      requestId: 'req-1',
    };
    const res = await mock.provision(ctx);
    expect(res.ok).toBe(true);
    expect(res.externalTenantId).toContain('ext_mudar_acme_');
    expect((await mock.suspend()).ok).toBe(true);
    expect((await mock.reactivate()).ok).toBe(true);
    expect((await mock.archive()).ok).toBe(true);
  });

  it('reuses an existing external id (idempotent retries)', async () => {
    const mock = new MockProductProvisioner();
    const ctx: any = {
      product: { code: 'mudar' },
      tenant: { slug: 'acme', externalTenantId: 'ext_existing' },
      requestId: 'req-2',
    };
    const res = await mock.provision(ctx);
    expect(res.externalTenantId).toBe('ext_existing');
  });
});
