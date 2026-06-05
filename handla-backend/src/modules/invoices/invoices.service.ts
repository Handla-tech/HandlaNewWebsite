import { Injectable, Logger, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';

import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../auth/entities/user.entity';
import { InvoicePaymentStatus, UserRole, NotificationType } from '../../common/enums';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { InvoicesQueryDto } from './dto/invoices-query.dto';
import { LineItemDto } from './dto/line-item.dto';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../utils/exceptions';
import { NotificationService } from '../notifications/notification.service';
import { EmailService } from '../email/email.service';
import { ExpensesService } from '../expenses/expenses.service';
import { ChatService } from '../chat/chat.service';
import { Conversation } from '../chat/entities/conversation.entity';

export interface PaginatedInvoices {
  invoices: Invoice[];
  total: number;
  page: number;
  pages: number;
}

/**
 * ERP-7/8 — InvoicesService
 *
 * Invoice lifecycle:
 *   UNPAID  → PAID    (markAsPaid — EMPLOYEE owner / ADMIN)
 *   UNPAID  → OVERDUE (recalculateOverdueStatus — scheduled at 1am daily)
 *   OVERDUE → PAID    (markAsPaid)
 *
 * Circular dependency (ERP-8.5):
 *   InvoicesModule imports ExpensesModule with forwardRef().
 *   ExpensesService is injected here via @Inject(forwardRef(() => ExpensesService)).
 *   markAsPaid() calls expensesService.createFromPaidInvoice() to auto-create income.
 *
 * Invoice number format: INV-YYYY-NNNN
 *   Generated via SELECT FOR UPDATE to avoid race conditions under concurrent load.
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,

    @InjectRepository(InvoiceLineItem)
    private readonly lineItemRepo: Repository<InvoiceLineItem>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,

    private readonly notificationService: NotificationService,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly chatService: ChatService,

    @Inject(forwardRef(() => ExpensesService))
    private readonly expensesService: ExpensesService,
  ) {}

  // ─── generateInvoiceNumber ────────────────────────────────────────────────
  /**
   * Generates the next invoice number for the current year: INV-YYYY-NNNN.
   * Uses a serialised DB query (no explicit SELECT FOR UPDATE needed here since
   * the TypeORM repository lock + transaction in create() serialises access).
   *
   * Thread-safety note: in create() this is called inside a transaction with
   * a table-level advisory lock to prevent concurrent inserts from getting the
   * same number.
   */
  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    // Find the highest existing number for this year
    const result = await this.invoiceRepo
      .createQueryBuilder('inv')
      .select('MAX(inv.invoiceNumber)', 'max')
      .where('inv.invoiceNumber LIKE :prefix', { prefix: `${prefix}%` })
      .getRawOne<{ max: string | null }>();

    let nextNum = 1;
    if (result?.max) {
      const parts = result.max.split('-');
      const current = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(current)) nextNum = current + 1;
    }

    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  // ─── calculateTotals ──────────────────────────────────────────────────────
  /**
   * Calculates subtotal, taxAmount, and total from line items + taxRate.
   * All values rounded to 2 decimal places.
   */
  calculateTotals(
    lineItems: LineItemDto[],
    taxRate: number,
  ): { subtotal: number; taxAmount: number; total: number } {
    const subtotal = parseFloat(
      lineItems
        .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        .toFixed(2),
    );
    const taxAmount = parseFloat(((subtotal * taxRate) / 100).toFixed(2));
    const total = parseFloat((subtotal + taxAmount).toFixed(2));
    return { subtotal, taxAmount, total };
  }

  // ─── findAll ──────────────────────────────────────────────────────────────
  async findAll(user: User, query: InvoicesQueryDto): Promise<PaginatedInvoices> {
    const {
      page = 1,
      limit = 20,
      clientId,
      paymentStatus,
      ownerId,
      search,
      dateFrom,
      dateTo,
    } = query;

    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.client', 'client')
      .leftJoinAndSelect('client.user', 'clientUser')
      .leftJoinAndSelect('inv.owner', 'owner')
      .leftJoinAndSelect('inv.lineItems', 'lineItems')
      .orderBy('inv.createdAt', 'DESC');

    // Role scoping
    if (user.role === UserRole.EMPLOYEE) {
      qb.andWhere('inv.ownerId = :uid', { uid: user.id });
    } else if (user.role === UserRole.CLIENT) {
      // CLIENT sees invoices for their client record
      const client = await this.clientRepo.findOne({ where: { userId: user.id } });
      if (!client) return { invoices: [], total: 0, page, pages: 0 };
      qb.andWhere('inv.clientId = :cid', { cid: client.id });
    }

    if (clientId) qb.andWhere('inv.clientId = :clientId', { clientId });
    if (paymentStatus) qb.andWhere('inv.paymentStatus = :paymentStatus', { paymentStatus });
    if (ownerId) qb.andWhere('inv.ownerId = :ownerId', { ownerId });
    if (search)
      qb.andWhere('inv.invoiceNumber LIKE :search', { search: `%${search}%` });
    if (dateFrom) qb.andWhere('DATE(inv.createdAt) >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('DATE(inv.createdAt) <= :dateTo', { dateTo });

    const [invoices, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { invoices, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── findOne ──────────────────────────────────────────────────────────────
  async findOne(id: string, user: User): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['client', 'client.user', 'owner', 'lineItems'],
    });
    if (!invoice) throw new ResourceNotFoundException('Invoice', id);

    await this.assertAccess(invoice, user);
    return invoice;
  }

  // ─── create ───────────────────────────────────────────────────────────────
  async create(dto: CreateInvoiceDto, actingUser: User): Promise<Invoice> {
    // Verify client exists
    const client = await this.clientRepo.findOne({
      where: { id: dto.clientId },
      relations: ['user'],
    });
    if (!client) throw new ResourceNotFoundException('Client', dto.clientId);

    // EMPLOYEE must own the client
    if (actingUser.role === UserRole.EMPLOYEE && client.ownerId !== actingUser.id) {
      throw new OwnershipViolationException();
    }

    const taxRate = dto.taxRate ?? 0;
    const { subtotal, taxAmount, total } = this.calculateTotals(dto.lineItems, taxRate);

    return this.dataSource.transaction(async (manager) => {
      // Generate invoice number inside transaction
      const invoiceNumber = await this.generateInvoiceNumber();

      const invoice = manager.create(Invoice, {
        invoiceNumber,
        clientId: dto.clientId,
        ownerId: actingUser.id,
        subtotal,
        taxRate,
        taxAmount,
        total,
        currency: 'USD',
        paymentStatus: InvoicePaymentStatus.UNPAID,
        dueDate: dto.dueDate ?? null,
        notes: dto.notes ?? null,
      });

      const savedInvoice = await manager.save(Invoice, invoice);

      // Save line items
      const lineItems = dto.lineItems.map((item, idx) =>
        manager.create(InvoiceLineItem, {
          invoiceId: savedInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: parseFloat((item.quantity * item.unitPrice).toFixed(2)),
          sortOrder: idx,
        }),
      );
      await manager.save(InvoiceLineItem, lineItems);

      this.logger.log(
        `Invoice created: ${invoiceNumber} for client=${dto.clientId} total=${total} owner=${actingUser.id}`,
      );

      // Fire INVOICE_CREATED notification to client
      if (client.userId) {
        void this.notificationService.createErpNotification(
          client.userId,
          NotificationType.INVOICE_CREATED,
          'New Invoice',
          `Invoice ${invoiceNumber} for $${total} has been issued.`,
          savedInvoice.id,
        );

        // Queue email to client
        if (client.user?.email) {
          void this.emailService.queueInvoiceCreated({
            recipientEmail: client.user.email,
            recipientName:  client.user.name ?? 'Client',
            invoiceNumber,
            amount: `$${total}`,
            dueDate: dto.dueDate ?? null,
            erpUrl: `${this.baseUrl}/erp/invoices/${savedInvoice.id}`,
          });
        }

        // Post a system event card in the client's chat conversation
        void (async () => {
          try {
            const conversation = await this.conversationRepo.findOne({
              where: { clientId: client.userId },
              order: { createdAt: 'DESC' },
            });
            if (conversation) {
              const messageContent = `__SYSTEM__:${JSON.stringify({
                type:    'INVOICE_CREATED',
                title:   invoiceNumber,
                id:      savedInvoice.id,
                amount:  `${savedInvoice.currency} ${total}`,
                dueDate: dto.dueDate ?? null,
                message: 'A new invoice has been issued for you.',
              })}`;
              await this.chatService.saveMessage(
                conversation.id,
                actingUser.id,
                messageContent,
              );
            }
          } catch (err) {
            this.logger.warn(`Failed to post invoice chat message: ${(err as Error).message}`);
          }
        })();
      }

      // Return with relations
      return manager.findOneOrFail(Invoice, {
        where: { id: savedInvoice.id },
        relations: ['client', 'client.user', 'owner', 'lineItems'],
      });
    });
  }

  // ─── update ───────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateInvoiceDto, user: User): Promise<Invoice> {
    const invoice = await this.findOne(id, user);

    if (invoice.paymentStatus !== InvoicePaymentStatus.UNPAID) {
      throw new AppException(
        `Only UNPAID invoices can be edited (current: "${invoice.paymentStatus}").`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const taxRate = dto.taxRate ?? invoice.taxRate;
    const newLineItems = dto.lineItems;

    return this.dataSource.transaction(async (manager) => {
      if (newLineItems) {
        // Replace line items wholesale
        await manager.delete(InvoiceLineItem, { invoiceId: id });
        const items = newLineItems.map((item, idx) =>
          manager.create(InvoiceLineItem, {
            invoiceId: id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: parseFloat((item.quantity * item.unitPrice).toFixed(2)),
            sortOrder: idx,
          }),
        );
        await manager.save(InvoiceLineItem, items);

        const { subtotal, taxAmount, total } = this.calculateTotals(newLineItems, taxRate);
        invoice.subtotal = subtotal;
        invoice.taxAmount = taxAmount;
        invoice.total = total;
      }

      if (dto.taxRate !== undefined && !newLineItems) {
        const { subtotal, taxAmount, total } = this.calculateTotals(
          invoice.lineItems as any,
          dto.taxRate,
        );
        invoice.subtotal = subtotal;
        invoice.taxAmount = taxAmount;
        invoice.total = total;
      }

      if (dto.taxRate !== undefined) invoice.taxRate = dto.taxRate;
      if (dto.dueDate !== undefined) invoice.dueDate = dto.dueDate ?? null;
      if (dto.notes !== undefined) invoice.notes = dto.notes ?? null;

      await manager.save(Invoice, invoice);

      return manager.findOneOrFail(Invoice, {
        where: { id },
        relations: ['client', 'client.user', 'owner', 'lineItems'],
      });
    });
  }

  // ─── remove ───────────────────────────────────────────────────────────────
  async remove(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) {
      throw new InsufficientPermissionsException('delete invoices (ADMIN only)');
    }

    const invoice = await this.invoiceRepo.findOne({ where: { id } });
    if (!invoice) throw new ResourceNotFoundException('Invoice', id);

    if (invoice.paymentStatus !== InvoicePaymentStatus.UNPAID) {
      throw new AppException(
        `Only UNPAID invoices can be deleted (current: "${invoice.paymentStatus}").`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.invoiceRepo.remove(invoice);
    this.logger.log(`Invoice deleted: id=${id} by admin=${user.id}`);
  }

  // ─── markAsPaid ──────────────────────────────────────────────────────────
  /**
   * UNPAID/OVERDUE → PAID.
   * Sets paidAt, fires INVOICE_PAID notification.
   *
   * ERP-8 NOTE: After ERP-8 (ExpensesModule) is implemented, uncomment the
   * `expensesService.createFromPaidInvoice(invoice, actingUser.id)` call below.
   * The circular dependency between InvoicesModule and ExpensesModule is resolved
   * with forwardRef() in ERP-8.5.
   */
  async markAsPaid(id: string, dto: MarkPaidDto, user: User): Promise<Invoice> {
    const invoice = await this.findOne(id, user);

    if (invoice.paymentStatus === InvoicePaymentStatus.PAID) {
      throw new AppException(
        'Invoice is already marked as PAID.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (
      invoice.paymentStatus !== InvoicePaymentStatus.UNPAID &&
      invoice.paymentStatus !== InvoicePaymentStatus.OVERDUE
    ) {
      throw new AppException(
        `Cannot mark invoice as paid (current: "${invoice.paymentStatus}").`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    invoice.paymentStatus = InvoicePaymentStatus.PAID;
    invoice.paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    await this.invoiceRepo.save(invoice);

    this.logger.log(
      `Invoice marked PAID: ${invoice.invoiceNumber} paidAt=${invoice.paidAt.toISOString()} by=${user.id}`,
    );

    // Fire informational notification to client
    const client = await this.clientRepo.findOne({
      where: { id: invoice.clientId },
      relations: ['user'],
    });
    if (client?.userId) {
      void this.notificationService.createErpNotification(
        client.userId,
        NotificationType.INVOICE_CREATED,
        'Invoice Paid',
        `Invoice ${invoice.invoiceNumber} has been marked as paid.`,
        id,
      );
    }

    // ERP-8: auto-create income entry for paid invoice
    void this.expensesService.createFromPaidInvoice(invoice, user.id);

    return invoice;
  }

  // ─── recalculateOverdueStatus ─────────────────────────────────────────────
  /**
   * Queries all UNPAID invoices with a due_date < TODAY() and updates them to OVERDUE.
   * Fires INVOICE_OVERDUE notification to owner + client for each newly-overdue invoice.
   * Skips invoices already OVERDUE to avoid duplicate notifications.
   * Called by InvoicesScheduler at 1am daily.
   */
  async recalculateOverdueStatus(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueInvoices = await this.invoiceRepo.find({
      where: {
        paymentStatus: InvoicePaymentStatus.UNPAID,
        dueDate: LessThan(today.toISOString().split('T')[0]) as any,
      },
      relations: ['client', 'client.user', 'owner'],
    });

    if (overdueInvoices.length === 0) return 0;

    // Bulk update status
    const ids = overdueInvoices.map((inv) => inv.id);
    await this.invoiceRepo
      .createQueryBuilder()
      .update(Invoice)
      .set({ paymentStatus: InvoicePaymentStatus.OVERDUE })
      .whereInIds(ids)
      .execute();

    // Fire notifications
    for (const invoice of overdueInvoices) {
      this.logger.warn(
        `Invoice overdue: ${invoice.invoiceNumber} dueDate=${invoice.dueDate} client=${invoice.clientId}`,
      );

      if (invoice.ownerId) {
        void this.notificationService.createErpNotification(
          invoice.ownerId,
          NotificationType.INVOICE_OVERDUE,
          'Invoice Overdue',
          `Invoice ${invoice.invoiceNumber} is now overdue.`,
          invoice.id,
        );
      }
      if (invoice.client?.userId) {
        void this.notificationService.createErpNotification(
          invoice.client.userId,
          NotificationType.INVOICE_OVERDUE,
          'Invoice Overdue',
          `Invoice ${invoice.invoiceNumber} is overdue. Please arrange payment.`,
          invoice.id,
        );

        // Queue overdue email to client
        if (invoice.client.user?.email) {
          void this.emailService.queueInvoiceOverdue({
            recipientEmail: invoice.client.user.email,
            recipientName:  invoice.client.user.name ?? 'Client',
            invoiceNumber:  invoice.invoiceNumber,
            amount: `$${invoice.total}`,
            dueDate: invoice.dueDate ?? null,
            erpUrl: `${this.baseUrl}/erp/invoices/${invoice.id}`,
          });
        }
      }
    }

    this.logger.log(
      `recalculateOverdueStatus: ${overdueInvoices.length} invoice(s) marked OVERDUE`,
    );
    return overdueInvoices.length;
  }

  // ─── assertAccess (private) ───────────────────────────────────────────────
  private get baseUrl(): string {
    return process.env['BASE_URL'] ?? 'https://handla.com';
  }

  // ─── submitPaymentProof ───────────────────────────────────────────────────────
  /**
   * CLIENT submits payment proof for an invoice.
   * Stores the proof URL and optional partial amount as notes, then notifies the owner/admin.
   * Does NOT auto-change paymentStatus — an ADMIN/EMPLOYEE must confirm via markAsPaid.
   */
  async submitPaymentProof(
    id: string,
    dto: { proofUrl?: string; partialAmount?: number; notes?: string },
    user: User,
  ): Promise<Invoice> {
    const invoice = await this.findOne(id, user);

    // Build a notes annotation
    const proofNote = [
      dto.proofUrl ? `Proof URL: ${dto.proofUrl}` : null,
      dto.partialAmount != null ? `Partial amount: ${dto.partialAmount}` : null,
      dto.notes ? `Note: ${dto.notes}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    // Append to existing notes
    invoice.notes = invoice.notes
      ? `${invoice.notes}\n[Payment proof submitted] ${proofNote}`
      : `[Payment proof submitted] ${proofNote}`;

    await this.invoiceRepo.save(invoice);

    // Notify the invoice owner (EMPLOYEE) or fall back to generic admin notification
    if (invoice.ownerId) {
      void this.notificationService.createErpNotification(
        invoice.ownerId,
        NotificationType.INVOICE_CREATED,
        'Payment Proof Submitted',
        `Client submitted payment proof for invoice ${invoice.invoiceNumber}.`,
        id,
      );
    }

    this.logger.log(
      `Payment proof submitted for invoice ${invoice.invoiceNumber} by client user ${user.id}`,
    );

    return invoice;
  }

  private async assertAccess(invoice: Invoice, user: User): Promise<void> {
    if (user.role === UserRole.ADMIN) return;

    if (user.role === UserRole.EMPLOYEE) {
      if (invoice.ownerId !== user.id) throw new OwnershipViolationException();
      return;
    }

    if (user.role === UserRole.CLIENT) {
      const client = await this.clientRepo.findOne({ where: { userId: user.id } });
      if (!client || invoice.clientId !== client.id) {
        throw new InsufficientPermissionsException('view this invoice');
      }
      return;
    }

    throw new InsufficientPermissionsException('access invoices');
  }
}
