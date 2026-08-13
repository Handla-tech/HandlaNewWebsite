import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { randomUUID } from 'crypto';

import { Quotation } from './entities/quotation.entity';
import { QuotationLineItem } from './entities/quotation-line-item.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../auth/entities/user.entity';
import {
  QuotationStatus,
  UserRole,
  NotificationType,
} from '../../common/enums';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationsQueryDto } from './dto/quotations-query.dto';
import { QuotationLineItemDto } from './dto/quotation-line-item.dto';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../utils/exceptions';
import { ContractsService } from '../contracts/contracts.service';
import { InvoicesService } from '../invoices/invoices.service';
import { NotificationService } from '../notifications/notification.service';

export interface PaginatedQuotations {
  quotations: Quotation[];
  total: number;
  page: number;
  pages: number;
}

/**
 * QUO-1 — QuotationsService
 *
 * Sales estimates that convert into a draft Contract + draft Invoice on accept.
 * Public accept/reject via non-guessable publicToken.
 */
@Injectable()
export class QuotationsService {
  private readonly logger = new Logger(QuotationsService.name);

  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepo: Repository<Quotation>,
    @InjectRepository(QuotationLineItem)
    private readonly lineItemRepo: Repository<QuotationLineItem>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly dataSource: DataSource,
    private readonly contractsService: ContractsService,
    private readonly invoicesService: InvoicesService,
    private readonly notificationService: NotificationService,
  ) {}

  // ─── helpers ────────────────────────────────────────────────────────────────
  async generateQuoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `QUO-${year}-`;
    const result = await this.quotationRepo
      .createQueryBuilder('q')
      .select('MAX(q.quoteNumber)', 'max')
      .where('q.quoteNumber LIKE :prefix', { prefix: `${prefix}%` })
      .getRawOne<{ max: string | null }>();

    let nextNum = 1;
    if (result?.max) {
      const parts = result.max.split('-');
      const current = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(current)) nextNum = current + 1;
    }
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  calculateTotals(
    lineItems: QuotationLineItemDto[],
    taxRate: number,
  ): { subtotal: number; taxAmount: number; total: number } {
    const subtotal = parseFloat(
      lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2),
    );
    const taxAmount = parseFloat(((subtotal * taxRate) / 100).toFixed(2));
    const total = parseFloat((subtotal + taxAmount).toFixed(2));
    return { subtotal, taxAmount, total };
  }

  // ─── findAll ──────────────────────────────────────────────────────────────
  async findAll(user: User, query: QuotationsQueryDto): Promise<PaginatedQuotations> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const qb = this.quotationRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.client', 'client')
      .leftJoinAndSelect('client.user', 'clientUser')
      .leftJoinAndSelect('q.owner', 'owner')
      .leftJoinAndSelect('q.lineItems', 'lineItems')
      .orderBy('q.createdAt', 'DESC');

    if (user.role === UserRole.EMPLOYEE) {
      qb.andWhere('q.owner_id = :uid', { uid: user.id });
    } else if (user.role === UserRole.CLIENT) {
      const client = await this.clientRepo.findOne({ where: { userId: user.id } });
      if (!client) return { quotations: [], total: 0, page, pages: 0 };
      qb.andWhere('q.client_id = :cid', { cid: client.id });
    }

    if (query.clientId) qb.andWhere('q.client_id = :clientId', { clientId: query.clientId });
    if (query.status) qb.andWhere('q.status = :status', { status: query.status });
    if (query.ownerId) qb.andWhere('q.owner_id = :ownerId', { ownerId: query.ownerId });
    if (query.search) qb.andWhere('q.quoteNumber LIKE :s', { s: `%${query.search}%` });

    const [quotations, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { quotations, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── findOne (auth) ─────────────────────────────────────────────────────────
  async findOne(id: string, user: User): Promise<Quotation> {
    const quotation = await this.quotationRepo.findOne({
      where: { id },
      relations: ['client', 'client.user', 'owner', 'lineItems'],
    });
    if (!quotation) throw new ResourceNotFoundException('Quotation', id);
    await this.assertAccess(quotation, user);
    return quotation;
  }

  // ─── findByPublicToken (public, sanitized) ──────────────────────────────────
  async findByPublicToken(token: string): Promise<any> {
    const q = await this.quotationRepo.findOne({
      where: { publicToken: token },
      relations: ['client', 'client.user', 'owner', 'lineItems'],
    });
    if (!q) throw new ResourceNotFoundException('Quotation', token);

    return {
      id: q.id,
      quoteNumber: q.quoteNumber,
      title: q.title,
      status: q.status,
      subtotal: Number(q.subtotal),
      taxRate: Number(q.taxRate),
      taxAmount: Number(q.taxAmount),
      total: Number(q.total),
      currency: q.currency,
      validUntil: q.validUntil,
      notes: q.notes,
      createdAt: q.createdAt,
      lineItems: (q.lineItems ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((li) => ({
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          lineTotal: Number(li.lineTotal),
        })),
      client: q.client
        ? { name: q.client.user?.name ?? null, company: q.client.company ?? null }
        : null,
      issuer: q.owner ? { name: q.owner.name ?? null } : { name: 'Handla' },
    };
  }

  // ─── create ───────────────────────────────────────────────────────────────
  async create(dto: CreateQuotationDto, actingUser: User): Promise<Quotation> {
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    if (!client) throw new ResourceNotFoundException('Client', dto.clientId);
    if (actingUser.role === UserRole.EMPLOYEE && client.ownerId !== actingUser.id) {
      throw new OwnershipViolationException();
    }

    const taxRate = dto.taxRate ?? 0;
    const { subtotal, taxAmount, total } = this.calculateTotals(dto.lineItems, taxRate);

    return this.dataSource.transaction(async (manager) => {
      const quoteNumber = await this.generateQuoteNumber();

      const quotation = manager.create(Quotation, {
        quoteNumber,
        title: dto.title,
        publicToken: randomUUID(),
        clientId: dto.clientId,
        ownerId: actingUser.id,
        status: QuotationStatus.DRAFT,
        subtotal,
        taxRate,
        taxAmount,
        total,
        currency: dto.currency ?? null,
        validUntil: dto.validUntil ?? null,
        notes: dto.notes ?? null,
      });
      const saved = await manager.save(Quotation, quotation);

      const items = dto.lineItems.map((item, idx) =>
        manager.create(QuotationLineItem, {
          quotationId: saved.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: parseFloat((item.quantity * item.unitPrice).toFixed(2)),
          sortOrder: idx,
        }),
      );
      await manager.save(QuotationLineItem, items);

      this.logger.log(`Quotation created: ${quoteNumber} client=${dto.clientId} total=${total}`);

      return manager.findOneOrFail(Quotation, {
        where: { id: saved.id },
        relations: ['client', 'client.user', 'owner', 'lineItems'],
      });
    });
  }

  // ─── update (DRAFT only) ────────────────────────────────────────────────────
  async update(id: string, dto: UpdateQuotationDto, user: User): Promise<Quotation> {
    const quotation = await this.findOne(id, user);
    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new AppException(
        `Only DRAFT quotations can be edited (current: "${quotation.status}").`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const taxRate = dto.taxRate ?? quotation.taxRate;

    return this.dataSource.transaction(async (manager) => {
      if (dto.lineItems) {
        await manager.delete(QuotationLineItem, { quotationId: id });
        const items = dto.lineItems.map((item, idx) =>
          manager.create(QuotationLineItem, {
            quotationId: id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: parseFloat((item.quantity * item.unitPrice).toFixed(2)),
            sortOrder: idx,
          }),
        );
        await manager.save(QuotationLineItem, items);
        const totals = this.calculateTotals(dto.lineItems, taxRate);
        quotation.subtotal = totals.subtotal;
        quotation.taxAmount = totals.taxAmount;
        quotation.total = totals.total;
      } else if (dto.taxRate !== undefined) {
        const totals = this.calculateTotals(
          (quotation.lineItems ?? []).map((li) => ({
            description: li.description,
            quantity: Number(li.quantity),
            unitPrice: Number(li.unitPrice),
          })),
          dto.taxRate,
        );
        quotation.subtotal = totals.subtotal;
        quotation.taxAmount = totals.taxAmount;
        quotation.total = totals.total;
      }

      if (dto.title !== undefined) quotation.title = dto.title;
      if (dto.taxRate !== undefined) quotation.taxRate = dto.taxRate;
      if (dto.currency !== undefined) quotation.currency = dto.currency ?? null;
      if (dto.validUntil !== undefined) quotation.validUntil = dto.validUntil ?? null;
      if (dto.notes !== undefined) quotation.notes = dto.notes ?? null;

      await manager.save(Quotation, quotation);
      return manager.findOneOrFail(Quotation, {
        where: { id },
        relations: ['client', 'client.user', 'owner', 'lineItems'],
      });
    });
  }

  // ─── remove (DRAFT only, ADMIN) ─────────────────────────────────────────────
  async remove(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) {
      throw new InsufficientPermissionsException('delete quotations (ADMIN only)');
    }
    const quotation = await this.quotationRepo.findOne({ where: { id } });
    if (!quotation) throw new ResourceNotFoundException('Quotation', id);
    if (quotation.status === QuotationStatus.CONVERTED) {
      throw new AppException('Cannot delete a CONVERTED quotation.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    await this.quotationRepo.remove(quotation);
    this.logger.log(`Quotation deleted: ${id} by admin=${user.id}`);
  }

  // ─── send ────────────────────────────────────────────────────────────────────
  async send(id: string, user: User): Promise<Quotation> {
    const quotation = await this.findOne(id, user);
    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new AppException(
        `Only DRAFT quotations can be sent (current: "${quotation.status}").`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    quotation.status = QuotationStatus.SENT;
    quotation.sentAt = new Date();
    await this.quotationRepo.save(quotation);

    const client = await this.clientRepo.findOne({
      where: { id: quotation.clientId },
      relations: ['user'],
    });
    if (client?.userId) {
      void this.notificationService.createErpNotification(
        client.userId,
        NotificationType.QUOTATION_SENT,
        'New Quotation',
        `Quotation ${quotation.quoteNumber} has been sent to you.`,
        quotation.id,
      );
    }
    this.logger.log(`Quotation sent: ${quotation.quoteNumber}`);
    return quotation;
  }

  // ─── accept / reject ──────────────────────────────────────────────────────
  async acceptByToken(token: string): Promise<Quotation> {
    const quotation = await this.quotationRepo.findOne({ where: { publicToken: token } });
    if (!quotation) throw new ResourceNotFoundException('Quotation', token);
    return this.applyAccept(quotation);
  }

  async accept(id: string, user: User): Promise<Quotation> {
    const quotation = await this.findOne(id, user);
    return this.applyAccept(quotation);
  }

  private async applyAccept(quotation: Quotation): Promise<Quotation> {
    if (quotation.status !== QuotationStatus.SENT) {
      throw new AppException(
        `Only SENT quotations can be accepted (current: "${quotation.status}").`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    quotation.status = QuotationStatus.ACCEPTED;
    quotation.acceptedAt = new Date();
    await this.quotationRepo.save(quotation);

    if (quotation.ownerId) {
      void this.notificationService.createErpNotification(
        quotation.ownerId,
        NotificationType.QUOTATION_ACCEPTED,
        'Quotation Accepted',
        `Quotation ${quotation.quoteNumber} was accepted by the client.`,
        quotation.id,
      );
    }
    this.logger.log(`Quotation accepted: ${quotation.quoteNumber}`);
    return quotation;
  }

  async rejectByToken(token: string, reason?: string): Promise<Quotation> {
    const quotation = await this.quotationRepo.findOne({ where: { publicToken: token } });
    if (!quotation) throw new ResourceNotFoundException('Quotation', token);
    return this.applyReject(quotation, reason);
  }

  async reject(id: string, user: User, reason?: string): Promise<Quotation> {
    const quotation = await this.findOne(id, user);
    return this.applyReject(quotation, reason);
  }

  private async applyReject(quotation: Quotation, reason?: string): Promise<Quotation> {
    if (quotation.status !== QuotationStatus.SENT) {
      throw new AppException(
        `Only SENT quotations can be rejected (current: "${quotation.status}").`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    quotation.status = QuotationStatus.REJECTED;
    quotation.rejectedAt = new Date();
    if (reason) {
      quotation.notes = quotation.notes
        ? `${quotation.notes}\n[Rejected] ${reason}`
        : `[Rejected] ${reason}`;
    }
    await this.quotationRepo.save(quotation);

    if (quotation.ownerId) {
      void this.notificationService.createErpNotification(
        quotation.ownerId,
        NotificationType.QUOTATION_REJECTED,
        'Quotation Rejected',
        `Quotation ${quotation.quoteNumber} was rejected by the client.`,
        quotation.id,
      );
    }
    this.logger.log(`Quotation rejected: ${quotation.quoteNumber}`);
    return quotation;
  }

  // ─── convert → draft Contract + draft Invoice ───────────────────────────────
  async convert(id: string, user: User): Promise<Quotation> {
    const quotation = await this.findOne(id, user);
    if (quotation.status !== QuotationStatus.ACCEPTED) {
      throw new AppException(
        `Only ACCEPTED quotations can be converted (current: "${quotation.status}").`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const sortedItems = (quotation.lineItems ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // 1) Draft invoice from the same line items + tax
    const invoice = await this.invoicesService.create(
      {
        clientId: quotation.clientId,
        taxRate: Number(quotation.taxRate),
        notes: `Generated from quotation ${quotation.quoteNumber}`,
        lineItems: sortedItems.map((li) => ({
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
        })),
      } as any,
      user,
    );

    // 2) Draft contract referencing the quotation
    const bodyLines = sortedItems
      .map((li) => `- ${li.description} × ${Number(li.quantity)} @ ${Number(li.unitPrice)}`)
      .join('\n');
    const contract = await this.contractsService.create(
      {
        title: quotation.title || `Agreement — ${quotation.quoteNumber}`,
        clientId: quotation.clientId,
        body:
          `This agreement is generated from accepted quotation ${quotation.quoteNumber}.\n\n` +
          `Scope / line items:\n${bodyLines}\n\n` +
          `Total: ${quotation.currency ?? ''} ${Number(quotation.total)}.`,
      } as any,
      user,
    );

    quotation.status = QuotationStatus.CONVERTED;
    quotation.convertedInvoiceId = invoice.id;
    quotation.convertedContractId = contract.id;
    await this.quotationRepo.save(quotation);

    this.logger.log(
      `Quotation converted: ${quotation.quoteNumber} → invoice=${invoice.id} contract=${contract.id}`,
    );
    return this.quotationRepo.findOneOrFail({
      where: { id: quotation.id },
      relations: ['client', 'client.user', 'owner', 'lineItems'],
    });
  }

  // ─── expiry scheduler ─────────────────────────────────────────────────────
  async recalculateExpiredStatus(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const expiring = await this.quotationRepo.find({
      where: {
        status: QuotationStatus.SENT,
        validUntil: LessThan(today) as any,
      },
    });
    if (expiring.length === 0) return 0;

    const ids = expiring.map((q) => q.id);
    await this.quotationRepo
      .createQueryBuilder()
      .update(Quotation)
      .set({ status: QuotationStatus.EXPIRED })
      .whereInIds(ids)
      .execute();

    this.logger.log(`recalculateExpiredStatus: ${expiring.length} quotation(s) marked EXPIRED`);
    return expiring.length;
  }

  // ─── access ─────────────────────────────────────────────────────────────────
  private async assertAccess(quotation: Quotation, user: User): Promise<void> {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.EMPLOYEE) {
      if (quotation.ownerId !== user.id) throw new OwnershipViolationException();
      return;
    }
    if (user.role === UserRole.CLIENT) {
      const client = await this.clientRepo.findOne({ where: { userId: user.id } });
      if (!client || quotation.clientId !== client.id) {
        throw new InsufficientPermissionsException('view this quotation');
      }
      return;
    }
    throw new InsufficientPermissionsException('access quotations');
  }
}
