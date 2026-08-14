import { Injectable, NotFoundException } from '@nestjs/common';

import { ProductProvisioner } from './product-provisioner.interface';
import { HttpProductProvisioner } from './http-product-provisioner';
import { MockProductProvisioner } from './mock-product-provisioner';
import { SaasProduct } from '../entities/saas-product.entity';

/**
 * SAAS-1 — Resolves the right ProductProvisioner for a product via its
 * `provisioner` key. This is the ONLY place adapters are selected — services
 * never branch on product code. New products/adapters register here without
 * touching the tenant lifecycle logic.
 */
@Injectable()
export class ProvisionerRegistry {
  private readonly map = new Map<string, ProductProvisioner>();

  constructor(
    private readonly http: HttpProductProvisioner,
    private readonly mock: MockProductProvisioner,
  ) {
    this.register(http);
    this.register(mock);
  }

  register(p: ProductProvisioner): void {
    this.map.set(p.key, p);
  }

  /** Resolve by explicit key. */
  get(key: string): ProductProvisioner {
    const p = this.map.get(key);
    if (!p) {
      throw new NotFoundException(`No provisioner registered for key "${key}"`);
    }
    return p;
  }

  /** Resolve for a product (falls back to "http" when unset). */
  forProduct(product: SaasProduct): ProductProvisioner {
    return this.get(product.provisioner || 'http');
  }
}
