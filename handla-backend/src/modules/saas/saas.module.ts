import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// SaaS entities
import { SaasProduct } from './entities/saas-product.entity';
import { SaasPlan } from './entities/saas-plan.entity';
import { SaasTenant } from './entities/saas-tenant.entity';
import { SaasSubscription } from './entities/saas-subscription.entity';
import { SaasTenantDomain } from './entities/saas-tenant-domain.entity';
import { SaasProvisioningLog } from './entities/saas-provisioning-log.entity';

// Reused cross-module entities (read/limited-write for the conversion path)
import { Client } from '../clients/entities/client.entity';
import { User } from '../auth/entities/user.entity';
import { Conversation } from '../chat/entities/conversation.entity';
import { ConversationAiState } from '../ai/entities/conversation-ai-state.entity';

// Services
import { ProductsService } from './services/products.service';
import { PlansService } from './services/plans.service';
import { TenantsService } from './services/tenants.service';
import { ProvisioningWorker } from './services/provisioning.worker';
import { LeadConversionService } from './services/lead-conversion.service';

// Provisioners
import { HttpProductProvisioner } from './provisioners/http-product-provisioner';
import { MockProductProvisioner } from './provisioners/mock-product-provisioner';
import { ProvisionerRegistry } from './provisioners/provisioner.registry';

// Guards + controllers
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';
import { SaasController } from './saas.controller';
import { SaasInternalController } from './saas-internal.controller';

/**
 * SAAS-1 — Phase 11 SaaS Control Plane module.
 *
 * Handla acts as the managed control plane for its products (Mudar / Matjari /
 * Manara): admin-only provisioning, a state-machine tenant lifecycle, an
 * idempotent/retry-safe background provisioning worker, and a secure inbound
 * callback for products to report status. Products own their own databases;
 * Handla stores only external ids + opaque metadata.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SaasProduct,
      SaasPlan,
      SaasTenant,
      SaasSubscription,
      SaasTenantDomain,
      SaasProvisioningLog,
      // Reused entities for the Lead → Client → Tenant conversion path.
      Client,
      User,
      Conversation,
      ConversationAiState,
    ]),
  ],
  controllers: [SaasController, SaasInternalController],
  providers: [
    ProductsService,
    PlansService,
    TenantsService,
    ProvisioningWorker,
    LeadConversionService,
    HttpProductProvisioner,
    MockProductProvisioner,
    ProvisionerRegistry,
    InternalApiKeyGuard,
  ],
  exports: [TenantsService, ProductsService, PlansService, LeadConversionService],
})
export class SaasModule {}
