import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

import { Contract } from './entities/contract.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../auth/entities/user.entity';
import { UserRole, ContractStatus, NotificationType } from '../../common/enums';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractsQueryDto } from './dto/contracts-query.dto';
import { renderContractBody } from './contract-body.renderer';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../utils/exceptions';
import { NotificationService } from '../notifications/notification.service';
import { EmailService } from '../email/email.service';
import { ChatService } from '../chat/chat.service';
import { AwsService } from '../aws/aws.service';
import { Conversation } from '../chat/entities/conversation.entity';
import { ConfigService } from '@nestjs/config';
import { PublicTokenService } from '../../common/public-token/public-token.service';
import { ManagePublicLinkDto } from '../../common/public-token/dto/manage-public-link.dto';
import {
  PublicDocumentType,
  PublicLinkManagementResult,
} from '../../common/public-token/public-token.types';

export interface PaginatedContracts {
  contracts: Contract[];
  total: number;
  page: number;
  pages: number;
}

/** INFO-01 — sanitized public projection returned by the public contract routes. */
export interface PublicContractProjection {
  id:        string;
  title:     string;
  body:      string;
  status:    ContractStatus;
  createdAt: Date;
  sentAt:    Date | null;
  signedAt:  Date | null;
  details:   Contract['details'];
  client: { name: string | null; company: string | null; email: string | null } | null;
  issuer: { name: string | null } | null;
}

/**
 * ERP-6 — ContractsService
 *
 * Contract lifecycle:
 *   DRAFT → SENT (sendToClient — EMPLOYEE/ADMIN)
 *   SENT  → SIGNED   (acceptContract — CLIENT only)
 *   SENT  → REJECTED (rejectContract — CLIENT only)
 *
 * PDF strategy (ERP-6.4):
 *   On signing, an HTML document is rendered via Handlebars (already installed)
 *   and uploaded to S3 as `contracts/<contractId>.html`.
 *   Using HTML avoids adding pdfkit or any binary-PDF dependency (ground rule:
 *   no new libraries). The s3Key and pdfUrl are stored on the contract record.
 *   Trade-off: the file is a standalone HTML document, not a binary PDF — clients
 *   download and print to PDF in-browser. This is sufficient for MVP.
 */
@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,

    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
    private readonly chatService: ChatService,
    private readonly awsService: AwsService,
    private readonly publicTokenService: PublicTokenService,
    private readonly configService: ConfigService,
  ) {}

  // ─── findAll ──────────────────────────────────────────────────────────────
  /**
   * Paginated list of contracts.
   * ADMIN: all. EMPLOYEE: own (ownerId = user.id). CLIENT: their own client's contracts.
   */
  async findAll(user: User, query: ContractsQueryDto): Promise<PaginatedContracts> {
    const { page = 1, limit = 20, clientId, status, ownerId, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.contractRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.client', 'cl')
      .leftJoinAndSelect('cl.user', 'clu')
      .leftJoinAndSelect('c.owner', 'o')
      .orderBy('c.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (user.role === UserRole.EMPLOYEE) {
      qb.andWhere('c.ownerId = :userId', { userId: user.id });
    }

    if (user.role === UserRole.CLIENT) {
      // Find client record for this user
      const clientRecord = await this.clientRepo.findOne({ where: { userId: user.id } });
      if (!clientRecord) {
        return { contracts: [], total: 0, page, pages: 0 };
      }
      qb.andWhere('c.clientId = :clientId', { clientId: clientRecord.id });
    }

    if (clientId) {
      qb.andWhere('c.clientId = :clientId', { clientId });
    }

    if (status) {
      qb.andWhere('c.status = :status', { status });
    }

    if (ownerId && user.role === UserRole.ADMIN) {
      qb.andWhere('c.ownerId = :ownerId', { ownerId });
    }

    if (search) {
      qb.andWhere('c.title LIKE :search', { search: `%${search}%` });
    }

    const [contracts, total] = await qb.getManyAndCount();

    return { contracts, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── findOne ──────────────────────────────────────────────────────────────
  async findOne(id: string, user: User): Promise<Contract> {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: ['client', 'client.user', 'owner'],
    });

    if (!contract) {
      throw new ResourceNotFoundException('Contract', id);
    }

    if (user.role === UserRole.EMPLOYEE && contract.ownerId !== user.id) {
      throw new OwnershipViolationException();
    }

    if (user.role === UserRole.CLIENT) {
      const clientRecord = await this.clientRepo.findOne({ where: { userId: user.id } });
      if (!clientRecord || contract.clientId !== clientRecord.id) {
        throw new InsufficientPermissionsException('access this contract');
      }
    }

    return contract;
  }

  // ─── findOnePublic ───────────────────────────────────────────────────────
  /**
   * Public read-only contract lookup used by the QR-code scanning flow.
   *
   * Security considerations:
   *  - Returns a sanitized projection: title, status, dates, the rendered
   *    body, the structured `details` payload (so public viewers and the
   *    print-PDF generator can render proper sectioned typography instead
   *    of falling back to flat text), plus minimal client / issuer
   *    display strings.
   *  - The `details` payload contains the same business data the
   *    authenticated CLIENT already sees on /erp/contracts/:id, so
   *    exposing it on the public viewer (which is gated by an
   *    un-enumerable UUID-v4 and rate-limited by ThrottlerModule) does
   *    not widen the data surface.
   *  - Never exposes the raw S3 key or any internal user-entity fields.
   *    Client/issuer projections are flattened to display strings.
   */
  async findOnePublic(id: string): Promise<PublicContractProjection> {
    // INFO-01 — legacy raw-id access disabled when PUBLIC_DOC_LEGACY_ID_LINKS=false.
    if (!this.configService.get<boolean>('publicDoc.legacyIdLinks')) {
      throw new ResourceNotFoundException('Contract', id);
    }
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: ['client', 'client.user', 'owner'],
    });
    if (!contract) {
      throw new ResourceNotFoundException('Contract', id);
    }
    return this.toPublicProjection(contract);
  }

  // ─── findOnePublicByToken (SECURE token route) ─────────────────────────────
  /**
   * INFO-01 — Secure public contract lookup by opaque capability token.
   * Looks up strictly by `public_token` (document-type-scoped), then funnels
   * through the centralized lifecycle validator: invalid/mismatch → 404 (no
   * existence oracle), revoked/expired → 410 Gone.
   */
  async findOnePublicByToken(token: string): Promise<PublicContractProjection> {
    const contract = await this.contractRepo.findOne({
      where: { publicToken: token },
      relations: ['client', 'client.user', 'owner'],
    });
    this.publicTokenService.assertActive(contract, token);
    return this.toPublicProjection(contract as Contract);
  }

  private toPublicProjection(contract: Contract): PublicContractProjection {
    return {
      id:        contract.id,
      title:     contract.title,
      body:      contract.body,
      status:    contract.status,
      createdAt: contract.createdAt,
      sentAt:    contract.sentAt,
      signedAt:  contract.signedAt,
      details:   contract.details ?? null,
      client: contract.client
        ? {
            name:    contract.client.user?.name ?? null,
            company: contract.client.company ?? null,
            email:   contract.client.user?.email ?? null,
          }
        : null,
      issuer: contract.owner
        ? { name: contract.owner.name ?? null }
        : { name: 'Handla' },
    };
  }

  // ─── create ───────────────────────────────────────────────────────────────
  /**
   * Create a DRAFT contract under a client.
   * EMPLOYEE must own the client.
   */
  async create(dto: CreateContractDto, actingUser: User): Promise<Contract> {
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    if (!client) {
      throw new ResourceNotFoundException('Client', dto.clientId);
    }

    if (actingUser.role === UserRole.EMPLOYEE && client.ownerId !== actingUser.id) {
      throw new AppException(
        `You do not own client ${dto.clientId}. EMPLOYEE can only create contracts for their own clients.`,
      );
    }

    const ownerId = actingUser.role === UserRole.EMPLOYEE ? actingUser.id : null;

    // Body resolution order:
    //   1. Explicit `body` if caller provided one (legacy / manual contracts).
    //   2. Auto-rendered from `details` when the comprehensive form is used.
    //   3. Empty fallback — Contract.body is NOT NULL so we always need a value.
    // The empty fallback should never trigger in practice — DTO validation
    // requires at least one of body/details to carry content — but guards
    // against silent failures.
    const resolvedBody =
      dto.body && dto.body.length > 0
        ? dto.body
        : dto.details
          ? renderContractBody(dto.details)
          : '';

    if (!resolvedBody || resolvedBody.length < 10) {
      throw new AppException(
        'Contract body is required (provide either `body` or `details`).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const contract = this.contractRepo.create({
      title: dto.title,
      body: resolvedBody,
      details: dto.details ?? null,
      clientId: dto.clientId,
      ownerId,
      status: ContractStatus.DRAFT,
    });

    const saved = await this.contractRepo.save(contract);
    this.logger.log(
      `Contract created: id=${saved.id} clientId=${saved.clientId} ownerId=${saved.ownerId ?? 'none'} by=${actingUser.id}`,
    );

    return this.contractRepo.findOne({
      where: { id: saved.id },
      relations: ['client', 'client.user', 'owner'],
    }) as Promise<Contract>;
  }

  // ─── update ───────────────────────────────────────────────────────────────
  /**
   * Update title/body — only allowed while contract is DRAFT.
   */
  async update(id: string, dto: UpdateContractDto, user: User): Promise<Contract> {
    const contract = await this.findOne(id, user);

    if (contract.status !== ContractStatus.DRAFT) {
      throw new AppException(
        `Cannot update contract in status "${contract.status}". Only DRAFT contracts can be edited.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (dto.title !== undefined) contract.title = dto.title;

    // Body update precedence:
    //   • If `details` is supplied → store it AND re-render body from it.
    //   • Else if `body` is supplied → store it verbatim, leave `details` alone.
    if (dto.details !== undefined) {
      contract.details = dto.details ?? null;
      contract.body    = dto.details ? renderContractBody(dto.details) : (dto.body ?? contract.body);
    } else if (dto.body !== undefined) {
      contract.body = dto.body;
    }

    const updated = await this.contractRepo.save(contract);
    this.logger.log(`Contract updated: id=${id} by=${user.id}`);

    return this.contractRepo.findOne({
      where: { id: updated.id },
      relations: ['client', 'client.user', 'owner'],
    }) as Promise<Contract>;
  }

  // ─── remove ───────────────────────────────────────────────────────────────
  /**
   * Hard-delete. ADMIN only. Only DRAFT contracts can be deleted.
   */
  async remove(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) {
      throw new InsufficientPermissionsException('delete contracts');
    }

    const contract = await this.contractRepo.findOne({ where: { id } });
    if (!contract) {
      throw new ResourceNotFoundException('Contract', id);
    }

    if (contract.status !== ContractStatus.DRAFT) {
      throw new AppException(
        `Cannot delete contract in status "${contract.status}". Only DRAFT contracts can be deleted.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.contractRepo.remove(contract);
    this.logger.log(`Contract deleted: id=${id} by admin=${user.id}`);
  }

  // ─── sendToClient ─────────────────────────────────────────────────────────
  /**
   * DRAFT → SENT.
   * Sends a summary message into the client's chat conversation, then fires
   * CONTRACT_SENT notifications to client user and contract owner.
   */
  async sendToClient(contractId: string, actingUser: User): Promise<Contract> {
    const contract = await this.findOne(contractId, actingUser);

    if (contract.status !== ContractStatus.DRAFT) {
      throw new AppException(
        `Contract is not in DRAFT status (current: "${contract.status}"). Cannot send.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Load client + their user for notification
    const client = await this.clientRepo.findOne({
      where: { id: contract.clientId },
      relations: ['user'],
    });
    if (!client) {
      throw new ResourceNotFoundException('Client', contract.clientId);
    }

    // Transition
    contract.status = ContractStatus.SENT;
    contract.sentAt = new Date();
    await this.contractRepo.save(contract);

    // Find the client user's conversation and post a message
    try {
      const conversation = await this.conversationRepo.findOne({
        where: { clientId: client.userId },
        order: { createdAt: 'DESC' },
      });

      if (conversation) {
        // System event card — rendered as a styled notification in the chat UI
        const messageContent = `__SYSTEM__:${JSON.stringify({
          type:    'CONTRACT_SENT',
          title:   contract.title,
          id:      contract.id,
          message: 'A contract has been sent to you for review and signature.',
        })}`;

        await this.chatService.saveMessage(
          conversation.id,
          actingUser.id,
          messageContent,
        );
      }
    } catch (err) {
      // Non-fatal: log but don't fail the transition
      this.logger.warn(`Failed to post contract message in chat: ${(err as Error).message}`);
    }

    // In-app notifications (typed ERP-9)
    void this.notificationService.createErpNotification(
      client.userId,
      NotificationType.CONTRACT_SENT,
      'Contract Sent for Signature',
      `"${contract.title}" has been sent for your review and signature.`,
      contractId,
    );

    if (contract.ownerId) {
      void this.notificationService.createErpNotification(
        contract.ownerId,
        NotificationType.CONTRACT_SENT,
        'Contract Sent',
        `Contract "${contract.title}" has been sent to the client.`,
        contractId,
      );
    }

    // Email notification to client
    if (client.user?.email) {
      void this.emailService.queueContractSent({
        recipientEmail: client.user.email,
        recipientName:  client.user.name ?? 'Client',
        contractTitle:  contract.title,
        contractId,
        erpUrl: `${this.baseUrl}/erp/contracts/${contractId}`,
      });
    }

    this.logger.log(`Contract sent: id=${contractId} to client=${client.userId} by=${actingUser.id}`);

    return this.contractRepo.findOne({
      where: { id: contractId },
      relations: ['client', 'client.user', 'owner'],
    }) as Promise<Contract>;
  }

  // ─── acceptContract ───────────────────────────────────────────────────────
  /**
   * SENT → SIGNED. CLIENT-only.
   * Generates and stores the HTML document on S3 after signing.
   */
  async acceptContract(contractId: string, clientUser: User): Promise<Contract> {
    if (clientUser.role !== UserRole.CLIENT) {
      throw new InsufficientPermissionsException('accept contracts (CLIENT only)');
    }

    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
      relations: ['client', 'client.user', 'owner'],
    });
    if (!contract) {
      throw new ResourceNotFoundException('Contract', contractId);
    }

    // Verify this CLIENT owns the contract's client record
    const clientRecord = await this.clientRepo.findOne({ where: { userId: clientUser.id } });
    if (!clientRecord || contract.clientId !== clientRecord.id) {
      throw new InsufficientPermissionsException('accept this contract');
    }

    if (contract.status !== ContractStatus.SENT) {
      throw new AppException(
        `Contract is not in SENT status (current: "${contract.status}"). Cannot accept.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    contract.status   = ContractStatus.SIGNED;
    contract.signedAt = new Date();
    const saved = await this.contractRepo.save(contract);

    // Generate and upload HTML document
    try {
      await this.generateAndStorePdf(saved);
    } catch (err) {
      this.logger.warn(`PDF generation failed for contract ${contractId}: ${(err as Error).message}`);
    }

    // In-app notifications (typed ERP-9)
    if (saved.ownerId) {
      void this.notificationService.createErpNotification(
        saved.ownerId,
        NotificationType.CONTRACT_SIGNED,
        'Contract Signed',
        `"${saved.title}" has been digitally signed by the client.`,
        contractId,
      );
    }

    // Notify all admins
    const admins = await this.userRepo.find({ where: { role: UserRole.ADMIN } });
    for (const admin of admins) {
      if (admin.id !== saved.ownerId) {
        void this.notificationService.createErpNotification(
          admin.id,
          NotificationType.CONTRACT_SIGNED,
          'Contract Signed',
          `"${saved.title}" has been digitally signed.`,
          contractId,
        );
      }
    }

    // Email to owner (employee)
    if (saved.owner?.email) {
      void this.emailService.queueContractSigned({
        recipientEmail: saved.owner.email,
        recipientName:  saved.owner.name ?? 'Team',
        contractTitle:  saved.title,
        contractId,
        erpUrl: `${this.baseUrl}/erp/contracts/${contractId}`,
      });
    }

    this.logger.log(`Contract accepted/signed: id=${contractId} by client=${clientUser.id}`);

    return this.contractRepo.findOne({
      where: { id: contractId },
      relations: ['client', 'client.user', 'owner'],
    }) as Promise<Contract>;
  }

  // ─── rejectContract ───────────────────────────────────────────────────────
  /**
   * SENT → REJECTED. CLIENT-only.
   */
  async rejectContract(contractId: string, clientUser: User): Promise<Contract> {
    if (clientUser.role !== UserRole.CLIENT) {
      throw new InsufficientPermissionsException('reject contracts (CLIENT only)');
    }

    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
      relations: ['client', 'client.user', 'owner'],
    });
    if (!contract) {
      throw new ResourceNotFoundException('Contract', contractId);
    }

    const clientRecord = await this.clientRepo.findOne({ where: { userId: clientUser.id } });
    if (!clientRecord || contract.clientId !== clientRecord.id) {
      throw new InsufficientPermissionsException('reject this contract');
    }

    if (contract.status !== ContractStatus.SENT) {
      throw new AppException(
        `Contract is not in SENT status (current: "${contract.status}"). Cannot reject.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    contract.status = ContractStatus.REJECTED;
    const saved = await this.contractRepo.save(contract);

    if (saved.ownerId) {
      void this.notificationService.createErpNotification(
        saved.ownerId,
        NotificationType.CONTRACT_REJECTED,
        'Contract Rejected',
        `"${saved.title}" has been rejected by the client.`,
        contractId,
      );

      // Email to owner (employee)
      if (saved.owner?.email) {
        void this.emailService.queueContractRejected({
          recipientEmail: saved.owner.email,
          recipientName:  saved.owner.name ?? 'Team',
          contractTitle:  saved.title,
          contractId,
          erpUrl: `${this.baseUrl}/erp/contracts/${contractId}`,
        });
      }
    }

    this.logger.log(`Contract rejected: id=${contractId} by client=${clientUser.id}`);

    return this.contractRepo.findOne({
      where: { id: contractId },
      relations: ['client', 'client.user', 'owner'],
    }) as Promise<Contract>;
  }

  // ─── generateAndStorePdf ──────────────────────────────────────────────────
  /**
   * ERP-6.4 — PDF strategy:
   *   Generate a self-contained HTML document from the contract using Handlebars
   *   (already installed as a project dependency). Upload to S3 as:
   *   `contracts/<contractId>.html` with ContentType `text/html`.
   *
   *   No binary PDF library required — clients can print-to-PDF in-browser.
   *   Trade-off documented: HTML document vs binary PDF (MVP choice).
   */
  async generateAndStorePdf(contract: Contract): Promise<void> {
    // Load Handlebars template
    const templatePath = path.join(__dirname, 'templates', 'contract.hbs');
    let templateSource: string;

    try {
      templateSource = fs.readFileSync(templatePath, 'utf8');
    } catch {
      // Fallback: inline minimal template if file not found at runtime
      templateSource = this.getInlineTemplate();
    }

    const template = Handlebars.compile(templateSource);

    const clientName = contract.client?.user?.name ?? 'Client';
    const signedDate = contract.signedAt
      ? new Date(contract.signedAt).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      : new Date().toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });

    const html = template({
      title:      contract.title,
      body:       contract.body,
      clientName,
      signedDate,
      contractId: contract.id,
    });

    const buffer = Buffer.from(html, 'utf8');
    const s3Key  = `contracts/${contract.id}.html`;

    await this.awsService.uploadBuffer(buffer, s3Key, 'text/html');

    const pdfUrl = this.awsService.buildFileUrl(s3Key);

    await this.contractRepo.update(contract.id, { s3Key, pdfUrl });

    this.logger.log(`Contract HTML document uploaded to S3: key=${s3Key} id=${contract.id}`);
  }

  // ─── getPdfSignedUrl ──────────────────────────────────────────────────────
  /**
   * Generate a short-lived presigned GET URL for the stored HTML document.
   */
  async getPdfSignedUrl(contractId: string, user: User): Promise<string> {
    const contract = await this.findOne(contractId, user);

    if (!contract.s3Key) {
      throw new AppException(
        'No document has been generated for this contract yet.',
        HttpStatus.NOT_FOUND,
      );
    }

    const result = await this.awsService.generatePresignedUrl(
      contract.s3Key,
      'text/html',
      900, // 15 minutes
    );

    return result.url;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private get baseUrl(): string {
    // Lazy-evaluate base URL — ContractsService does not inject ConfigService
    // to avoid widening the constructor signature. Falls back to production URL.
    return process.env['BASE_URL'] ?? 'https://handla.com';
  }

  private getInlineTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>{{title}}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; }
    h1   { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .meta { color: #555; font-size: 0.85rem; margin-bottom: 2rem; }
    .body { white-space: pre-wrap; line-height: 1.7; }
    .signature { margin-top: 3rem; border-top: 1px solid #ccc; padding-top: 1rem; }
  </style>
</head>
<body>
  <h1>{{title}}</h1>
  <div class="meta">Contract ID: {{contractId}} | Client: {{clientName}} | Signed: {{signedDate}}</div>
  <div class="body">{{body}}</div>
  <div class="signature">
    <p><strong>Digitally signed by:</strong> {{clientName}}</p>
    <p><strong>Date:</strong> {{signedDate}}</p>
  </div>
</body>
</html>`;
  }

  // ─── INFO-01 Public-link management (Phase 7) ──────────────────────────────

  /**
   * Management authorization: only ADMIN or the owning EMPLOYEE. CLIENT/LEAD
   * (and anonymous, blocked by guards) may never mint/revoke links. Contracts
   * created by an ADMIN have ownerId=null, so only ADMIN can manage those.
   */
  private assertManageAccess(contract: Contract, user: User): void {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.EMPLOYEE) {
      if (contract.ownerId !== user.id) throw new OwnershipViolationException();
      return;
    }
    throw new InsufficientPermissionsException('manage public links for this contract');
  }

  private async loadForManage(id: string, user: User): Promise<Contract> {
    const contract = await this.contractRepo.findOne({ where: { id } });
    if (!contract) throw new ResourceNotFoundException('Contract', id);
    this.assertManageAccess(contract, user);
    return contract;
  }

  private buildResult(contract: Contract, now: Date): PublicLinkManagementResult {
    return this.publicTokenService.buildManagementResult(
      PublicDocumentType.CONTRACT,
      contract.id,
      contract,
      this.configService.get<string>('auth.frontendUrl') ?? '',
      now,
    );
  }

  /** Generate/ensure an active public link for a contract. */
  async generatePublicLink(
    id: string,
    dto: ManagePublicLinkDto | undefined,
    user: User,
  ): Promise<PublicLinkManagementResult> {
    const now = new Date();
    const contract = await this.loadForManage(id, user);
    const created = this.publicTokenService.ensureToken(contract, now);
    if (created) {
      const defaultDays = this.configService.get<number>('publicDoc.defaultExpiryDays') ?? 0;
      contract.publicTokenExpiresAt = this.publicTokenService.resolveExpiry(dto, defaultDays, now);
    }
    await this.contractRepo.save(contract);
    this.logger.log(`Public link generated for contract id=${contract.id} by user ${user.id}`);
    return this.buildResult(contract, now);
  }

  /** Rotate the public link; old token stops working immediately. */
  async rotatePublicLink(
    id: string,
    dto: ManagePublicLinkDto | undefined,
    user: User,
  ): Promise<PublicLinkManagementResult> {
    const now = new Date();
    const contract = await this.loadForManage(id, user);
    const defaultDays = this.configService.get<number>('publicDoc.defaultExpiryDays') ?? 0;
    const expiresAt = this.publicTokenService.resolveExpiry(dto, defaultDays, now);
    this.publicTokenService.rotateToken(contract, { expiresAt }, now);
    await this.contractRepo.save(contract);
    this.logger.log(`Public link rotated for contract id=${contract.id} by user ${user.id}`);
    return this.buildResult(contract, now);
  }

  /** Revoke the public link; it stops working immediately. */
  async revokePublicLink(id: string, user: User): Promise<PublicLinkManagementResult> {
    const now = new Date();
    const contract = await this.loadForManage(id, user);
    this.publicTokenService.revokeToken(contract, now);
    await this.contractRepo.save(contract);
    this.logger.log(`Public link revoked for contract id=${contract.id} by user ${user.id}`);
    return this.buildResult(contract, now);
  }

  /** Set / change / clear the public link expiry. */
  async setPublicLinkExpiry(
    id: string,
    dto: ManagePublicLinkDto,
    user: User,
  ): Promise<PublicLinkManagementResult> {
    const now = new Date();
    const contract = await this.loadForManage(id, user);
    const defaultDays = this.configService.get<number>('publicDoc.defaultExpiryDays') ?? 0;
    const expiresAt = this.publicTokenService.resolveExpiry(dto, defaultDays, now);
    this.publicTokenService.setExpiry(contract, expiresAt);
    await this.contractRepo.save(contract);
    this.logger.log(`Public link expiry updated for contract id=${contract.id} by user ${user.id}`);
    return this.buildResult(contract, now);
  }
}
