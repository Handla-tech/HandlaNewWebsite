import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Client } from '../../clients/entities/client.entity';
import { User } from '../../auth/entities/user.entity';
import { Conversation } from '../../chat/entities/conversation.entity';
import { ConversationAiState } from '../../ai/entities/conversation-ai-state.entity';
import { SaasTenant } from '../entities/saas-tenant.entity';

import { TenantsService } from './tenants.service';
import { ConvertLeadDto } from '../dto/convert-lead.dto';
import {
  ClientStatus,
  UserRole,
  LeadStatus,
} from '../../../common/enums';

/**
 * SAAS-1 — Lead → Client → Tenant conversion path.
 *
 * Bridges the AI Lead Qualification module (Phase 10) to the SaaS Control
 * Plane (Phase 11). ADMIN-only (enforced at the controller). Two modes:
 *
 *   A) `conversationId`: promote a QUALIFIED AI lead. The conversation's
 *      customer User (role LEAD) is upgraded to CLIENT, a Client record is
 *      created (carrying the assigned employee as owner), the AI lead state is
 *      marked CONVERTED, and a tenant is provisioned.
 *
 *   B) `clientId`: the caller already has a Client; we skip promotion and just
 *      provision the tenant.
 *
 * The conversion NEVER stores product DB creds and delegates all provisioning
 * to TenantsService (idempotent, queued, retry-safe).
 */
@Injectable()
export class LeadConversionService {
  private readonly logger = new Logger(LeadConversionService.name);

  constructor(
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ConversationAiState)
    private readonly stateRepo: Repository<ConversationAiState>,
    private readonly tenantsService: TenantsService,
  ) {}

  async convert(
    dto: ConvertLeadDto,
    actingUserId: string,
  ): Promise<{ client: Client; tenant: SaasTenant; promoted: boolean }> {
    if (!dto.clientId && !dto.conversationId) {
      throw new BadRequestException('Provide either clientId or conversationId');
    }

    let client: Client;
    let promoted = false;
    let derivedName: string | undefined;

    if (dto.clientId) {
      // ── Mode B: existing client ──────────────────────────────────────────────
      const existing = await this.clientRepo.findOne({
        where: { id: dto.clientId },
        relations: ['user'],
      });
      if (!existing) throw new NotFoundException(`Client ${dto.clientId} not found`);
      client = existing;
      derivedName = existing.company ?? existing.user?.name ?? undefined;
    } else {
      // ── Mode A: promote an AI lead ───────────────────────────────────────────
      const { client: promotedClient, name } = await this.promoteFromConversation(
        dto.conversationId!,
        dto.contactEmail,
      );
      client = promotedClient;
      promoted = true;
      derivedName = name;
    }

    const tenantName = dto.tenantName || derivedName || 'Untitled tenant';

    const tenant = await this.tenantsService.create(
      {
        clientId: client.id,
        productId: dto.productId,
        planId: dto.planId,
        name: tenantName,
        slug: dto.slug,
        billingInterval: dto.billingInterval,
      },
      actingUserId,
    );

    return { client, tenant, promoted };
  }

  /**
   * Promote the customer user of an AI conversation to CLIENT and create a
   * Client record. Requires the AI lead to be QUALIFIED (or already CONVERTED).
   */
  private async promoteFromConversation(
    conversationId: string,
    contactEmailOverride?: string,
  ): Promise<{ client: Client; name?: string }> {
    const conversation = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const state = await this.stateRepo.findOne({ where: { conversationId } });
    if (!state) {
      throw new BadRequestException('This conversation has no AI lead state');
    }
    if (
      state.leadStatus !== LeadStatus.QUALIFIED &&
      state.leadStatus !== LeadStatus.CONVERTED
    ) {
      throw new BadRequestException(
        `Lead must be QUALIFIED before conversion (current: ${state.leadStatus})`,
      );
    }

    const leadData = (state.leadData ?? {}) as Record<string, any>;
    const customerUserId = conversation.clientId;

    // Load the customer user (the LEAD-role account behind the conversation).
    const user = await this.userRepo.findOne({ where: { id: customerUserId } });
    if (!user) {
      throw new NotFoundException(
        `Customer user ${customerUserId} for conversation not found`,
      );
    }

    // Enrich the user profile from lead data (non-destructive).
    const company = this.firstString(leadData.company);
    const phone = this.firstString(leadData.phone, leadData.contact);
    if (company && !user.company) user.company = company.slice(0, 120);
    if (phone && !user.phoneNumber) user.phoneNumber = phone.slice(0, 32);

    // Promote LEAD → CLIENT (idempotent — leave ADMIN/EMPLOYEE/CLIENT as-is).
    if (user.role === UserRole.LEAD) {
      user.role = UserRole.CLIENT;
    } else if (user.role !== UserRole.CLIENT) {
      throw new BadRequestException(
        `Conversation owner has role ${user.role}; only LEAD/CLIENT users can be converted`,
      );
    }
    await this.userRepo.save(user);

    // Create (or reuse) the Client record; owner = the assigned employee.
    let client = await this.clientRepo.findOne({ where: { userId: user.id } });
    if (!client) {
      client = this.clientRepo.create({
        userId: user.id,
        ownerId: conversation.assignedEmployeeId ?? null,
        company: company ?? null,
        status: ClientStatus.ACTIVE,
        notes: 'Auto-created from AI lead conversion',
      });
      client = await this.clientRepo.save(client);
      this.logger.log(
        `Client ${client.id} created from AI lead conversion (conversation ${conversationId})`,
      );
    }

    // Mark the AI lead as CONVERTED (idempotent).
    if (state.leadStatus !== LeadStatus.CONVERTED) {
      state.leadStatus = LeadStatus.CONVERTED;
      await this.stateRepo.save(state);
    }

    const name =
      company ?? this.firstString(leadData.name) ?? user.company ?? user.name;
    return { client, name };
  }

  private firstString(...vals: unknown[]): string | undefined {
    for (const v of vals) {
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  }
}
