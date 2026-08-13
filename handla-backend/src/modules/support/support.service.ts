import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomBytes, createHash } from 'crypto';

import { Ticket } from './entities/ticket.entity';
import { TicketReply } from './entities/ticket-reply.entity';
import { ClientApiKey } from './entities/client-api-key.entity';
import { Client } from '../clients/entities/client.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../auth/entities/user.entity';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketSource,
  UserRole,
  NotificationType,
} from '../../common/enums';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { TicketsQueryDto } from './dto/tickets-query.dto';
import { IngestTicketDto } from './dto/ingest-ticket.dto';
import { IngestReplyDto } from './dto/ingest-reply.dto';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../utils/exceptions';
import { NotificationService } from '../notifications/notification.service';

export interface PaginatedTickets {
  tickets: Ticket[];
  total: number;
  page: number;
  pages: number;
}

/** SLA response/resolution windows (hours) keyed by priority. */
const SLA_HOURS: Record<TicketPriority, { firstResponse: number; resolve: number }> = {
  [TicketPriority.URGENT]: { firstResponse: 1, resolve: 8 },
  [TicketPriority.HIGH]: { firstResponse: 4, resolve: 24 },
  [TicketPriority.MEDIUM]: { firstResponse: 8, resolve: 72 },
  [TicketPriority.LOW]: { firstResponse: 24, resolve: 168 },
};

/**
 * SUP — SupportService
 *
 * Ticketing tied to Client + optional Project, with threaded replies, simple
 * priority-based SLA windows, and per-client API keys for programmatic ingest.
 */
@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketReply)
    private readonly replyRepo: Repository<TicketReply>,
    @InjectRepository(ClientApiKey)
    private readonly apiKeyRepo: Repository<ClientApiKey>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
  ) {}

  // ─── helpers ────────────────────────────────────────────────────────────────
  async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TKT-${year}-`;
    const result = await this.ticketRepo
      .createQueryBuilder('t')
      .select('MAX(t.ticketNumber)', 'max')
      .where('t.ticketNumber LIKE :prefix', { prefix: `${prefix}%` })
      .getRawOne<{ max: string | null }>();

    let nextNum = 1;
    if (result?.max) {
      const parts = result.max.split('-');
      const current = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(current)) nextNum = current + 1;
    }
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  /** Computes SLA due dates from a priority relative to `from`. */
  computeSla(priority: TicketPriority, from = new Date()): {
    firstResponseDueAt: Date;
    resolveDueAt: Date;
  } {
    const cfg = SLA_HOURS[priority] ?? SLA_HOURS[TicketPriority.MEDIUM];
    return {
      firstResponseDueAt: new Date(from.getTime() + cfg.firstResponse * 3600_000),
      resolveDueAt: new Date(from.getTime() + cfg.resolve * 3600_000),
    };
  }

  /** Derived read-time SLA flag (open tickets whose response/resolve is overdue). */
  private decorateSla(ticket: Ticket): Ticket & { slaBreached: boolean } {
    const now = Date.now();
    const isOpen =
      ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED;
    let breached = false;
    if (isOpen) {
      if (!ticket.firstRespondedAt && ticket.firstResponseDueAt) {
        breached = new Date(ticket.firstResponseDueAt).getTime() < now;
      }
      if (!breached && ticket.resolveDueAt) {
        breached = new Date(ticket.resolveDueAt).getTime() < now;
      }
    }
    return Object.assign(ticket, { slaBreached: breached });
  }

  // ─── client resolution for CLIENT role ──────────────────────────────────────
  private async requireClientForUser(user: User): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { userId: user.id } });
    if (!client) {
      throw new InsufficientPermissionsException('access support (no client profile)');
    }
    return client;
  }

  // ─── findAll (role-scoped) ───────────────────────────────────────────────────
  async findAll(user: User, query: TicketsQueryDto): Promise<PaginatedTickets> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.client', 'client')
      .leftJoinAndSelect('client.user', 'clientUser')
      .leftJoinAndSelect('t.project', 'project')
      .leftJoinAndSelect('t.assignee', 'assignee')
      .orderBy('t.createdAt', 'DESC');

    if (user.role === UserRole.CLIENT) {
      const client = await this.requireClientForUser(user);
      qb.andWhere('t.client_id = :cid', { cid: client.id });
    } else if (user.role === UserRole.EMPLOYEE) {
      // Employees see tickets for clients they own OR tickets assigned to them.
      qb.andWhere('(client.owner_id = :uid OR t.assignee_id = :uid)', { uid: user.id });
    }

    if (query.clientId) qb.andWhere('t.client_id = :clientId', { clientId: query.clientId });
    if (query.projectId) qb.andWhere('t.project_id = :projectId', { projectId: query.projectId });
    if (query.assigneeId) qb.andWhere('t.assignee_id = :assigneeId', { assigneeId: query.assigneeId });
    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.priority) qb.andWhere('t.priority = :priority', { priority: query.priority });
    if (query.category) qb.andWhere('t.category = :category', { category: query.category });
    if (query.search) {
      qb.andWhere('(t.subject LIKE :s OR t.ticketNumber LIKE :s)', { s: `%${query.search}%` });
    }

    const [tickets, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    tickets.forEach((t) => this.decorateSla(t));
    return { tickets, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── findOne (with replies, access-checked) ──────────────────────────────────
  async findOne(id: string, user: User): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: [
        'client',
        'client.user',
        'project',
        'assignee',
        'reporter',
        'replies',
        'replies.author',
      ],
    });
    if (!ticket) throw new ResourceNotFoundException('Ticket', id);
    await this.assertAccess(ticket, user);

    // Hide internal notes from CLIENT.
    if (user.role === UserRole.CLIENT && ticket.replies) {
      ticket.replies = ticket.replies.filter((r) => !r.isInternal);
    }
    if (ticket.replies) {
      ticket.replies.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return this.decorateSla(ticket);
  }

  // ─── create (staff or client) ────────────────────────────────────────────────
  async create(dto: CreateTicketDto, user: User): Promise<Ticket> {
    let clientId: string;

    if (user.role === UserRole.CLIENT) {
      const client = await this.requireClientForUser(user);
      clientId = client.id;
    } else {
      if (!dto.clientId) {
        throw new AppException('clientId is required', HttpStatus.BAD_REQUEST);
      }
      const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
      if (!client) throw new ResourceNotFoundException('Client', dto.clientId);
      if (user.role === UserRole.EMPLOYEE && client.ownerId !== user.id) {
        throw new OwnershipViolationException();
      }
      clientId = client.id;
    }

    if (dto.projectId) {
      await this.assertProjectBelongsToClient(dto.projectId, clientId);
    }

    const priority = dto.priority ?? TicketPriority.MEDIUM;
    const sla = this.computeSla(priority);

    const ticket = this.ticketRepo.create({
      ticketNumber: await this.generateTicketNumber(),
      subject: dto.subject,
      description: dto.description,
      clientId,
      projectId: dto.projectId ?? null,
      assigneeId: user.role !== UserRole.CLIENT ? dto.assigneeId ?? null : null,
      reporterId: user.id,
      status: TicketStatus.OPEN,
      priority,
      category: dto.category ?? TicketCategory.QUESTION,
      source: TicketSource.WEB,
      attachments: dto.attachments ?? null,
      firstResponseDueAt: sla.firstResponseDueAt,
      resolveDueAt: sla.resolveDueAt,
    });
    const saved = await this.ticketRepo.save(ticket);
    this.logger.log(`Ticket created: ${saved.ticketNumber} client=${clientId} by=${user.id}`);

    await this.notifyTicketCreated(saved, clientId, user.role === UserRole.CLIENT);
    return this.findOne(saved.id, user);
  }

  // ─── addReply (staff or client) ──────────────────────────────────────────────
  async addReply(id: string, dto: CreateReplyDto, user: User): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['client'],
    });
    if (!ticket) throw new ResourceNotFoundException('Ticket', id);
    await this.assertAccess(ticket, user);

    if (ticket.status === TicketStatus.CLOSED) {
      throw new AppException('Cannot reply to a CLOSED ticket.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const isStaff = user.role === UserRole.ADMIN || user.role === UserRole.EMPLOYEE;
    const isInternal = isStaff ? dto.isInternal ?? false : false;

    await this.replyRepo.save(
      this.replyRepo.create({
        ticketId: ticket.id,
        authorId: user.id,
        authorName: user.name ?? null,
        body: dto.body,
        isInternal,
        attachments: dto.attachments ?? null,
      }),
    );

    // First staff (non-internal) reply stamps the SLA response milestone.
    if (isStaff && !isInternal && !ticket.firstRespondedAt) {
      ticket.firstRespondedAt = new Date();
    }
    // A client reply on a resolved/waiting ticket reopens it.
    if (!isStaff && (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.WAITING_CUSTOMER)) {
      ticket.status = TicketStatus.OPEN;
    } else if (isStaff && ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }
    await this.ticketRepo.save(ticket);

    await this.notifyReply(ticket, user, isInternal, isStaff);
    return this.findOne(ticket.id, user);
  }

  // ─── update (staff-only reclassify/assign/status) ────────────────────────────
  async update(id: string, dto: UpdateTicketDto, user: User): Promise<Ticket> {
    if (user.role === UserRole.CLIENT) {
      throw new InsufficientPermissionsException('update tickets');
    }
    const ticket = await this.ticketRepo.findOne({ where: { id }, relations: ['client'] });
    if (!ticket) throw new ResourceNotFoundException('Ticket', id);
    await this.assertAccess(ticket, user);

    if (dto.projectId !== undefined && dto.projectId !== null) {
      await this.assertProjectBelongsToClient(dto.projectId, ticket.clientId);
    }

    const prevStatus = ticket.status;

    if (dto.subject !== undefined) ticket.subject = dto.subject;
    if (dto.priority !== undefined) {
      ticket.priority = dto.priority;
      // Recompute SLA due dates relative to original creation if not yet responded.
      if (!ticket.firstRespondedAt) {
        const sla = this.computeSla(dto.priority, new Date(ticket.createdAt));
        ticket.firstResponseDueAt = sla.firstResponseDueAt;
        ticket.resolveDueAt = sla.resolveDueAt;
      }
    }
    if (dto.category !== undefined) ticket.category = dto.category;
    if (dto.assigneeId !== undefined) ticket.assigneeId = dto.assigneeId;
    if (dto.projectId !== undefined) ticket.projectId = dto.projectId;

    if (dto.status !== undefined && dto.status !== prevStatus) {
      ticket.status = dto.status;
      if (dto.status === TicketStatus.RESOLVED && !ticket.resolvedAt) {
        ticket.resolvedAt = new Date();
      }
      if (dto.status === TicketStatus.CLOSED && !ticket.closedAt) {
        ticket.closedAt = new Date();
      }
    }

    await this.ticketRepo.save(ticket);

    if (dto.status !== undefined && dto.status !== prevStatus) {
      await this.notifyStatusChange(ticket, prevStatus);
    }
    return this.findOne(ticket.id, user);
  }

  // ─── remove (ADMIN only) ──────────────────────────────────────────────────────
  async remove(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) {
      throw new InsufficientPermissionsException('delete tickets (ADMIN only)');
    }
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new ResourceNotFoundException('Ticket', id);
    await this.ticketRepo.remove(ticket);
    this.logger.log(`Ticket deleted: ${id} by admin=${user.id}`);
  }

  // ─── stats (staff dashboard) ──────────────────────────────────────────────────
  async getStats(user: User): Promise<Record<string, any>> {
    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .leftJoin('t.client', 'client');
    if (user.role === UserRole.EMPLOYEE) {
      qb.where('(client.owner_id = :uid OR t.assignee_id = :uid)', { uid: user.id });
    }
    const all = await qb.getMany();

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let open = 0;
    let slaBreached = 0;
    for (const t of all) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      const isOpen = t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CLOSED;
      if (isOpen) open += 1;
      if (this.decorateSla(t).slaBreached) slaBreached += 1;
    }
    return { total: all.length, open, slaBreached, byStatus, byPriority };
  }

  // ─── project ↔ client integrity ───────────────────────────────────────────────
  private async assertProjectBelongsToClient(projectId: string, clientId: string): Promise<void> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new ResourceNotFoundException('Project', projectId);
    if (project.clientId !== clientId) {
      throw new AppException(
        'Project does not belong to the ticket\u2019s client.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  SUP-2 — API keys + programmatic ingest
  // ════════════════════════════════════════════════════════════════════════════

  /** Creates a new API key for a client. Returns the plaintext key ONCE. */
  async createApiKey(
    clientId: string,
    label: string | undefined,
    user: User,
  ): Promise<{ apiKey: ClientApiKey; plaintextKey: string }> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) throw new ResourceNotFoundException('Client', clientId);
    if (user.role === UserRole.EMPLOYEE && client.ownerId !== user.id) {
      throw new OwnershipViolationException();
    }

    const plaintextKey = `hk_live_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(plaintextKey).digest('hex');

    const saved = await this.apiKeyRepo.save(
      this.apiKeyRepo.create({
        clientId,
        label: label ?? 'Default key',
        keyHash,
        prefix: plaintextKey.slice(0, 12),
        isActive: true,
        createdBy: user.id,
      }),
    );
    this.logger.log(`API key created for client=${clientId} by=${user.id}`);
    return { apiKey: saved, plaintextKey };
  }

  async listApiKeys(clientId: string, user: User): Promise<ClientApiKey[]> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) throw new ResourceNotFoundException('Client', clientId);
    if (user.role === UserRole.EMPLOYEE && client.ownerId !== user.id) {
      throw new OwnershipViolationException();
    }
    return this.apiKeyRepo.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeApiKey(id: string, user: User): Promise<ClientApiKey> {
    const key = await this.apiKeyRepo.findOne({ where: { id }, relations: ['client'] });
    if (!key) throw new ResourceNotFoundException('ApiKey', id);
    if (user.role === UserRole.EMPLOYEE && key.client?.ownerId !== user.id) {
      throw new OwnershipViolationException();
    }
    key.isActive = false;
    await this.apiKeyRepo.save(key);
    this.logger.log(`API key revoked: ${id} by=${user.id}`);
    return key;
  }

  /** Opens a ticket on behalf of the API key's client (source=API). */
  async ingestTicket(apiKey: ClientApiKey, dto: IngestTicketDto): Promise<Ticket> {
    const priority = dto.priority ?? TicketPriority.MEDIUM;
    const sla = this.computeSla(priority);

    const ticket = this.ticketRepo.create({
      ticketNumber: await this.generateTicketNumber(),
      subject: dto.subject,
      description: dto.externalReporter
        ? `${dto.description}\n\n— reported via API by ${dto.externalReporter}`
        : dto.description,
      clientId: apiKey.clientId,
      projectId: null,
      assigneeId: null,
      reporterId: null,
      status: TicketStatus.OPEN,
      priority,
      category: dto.category ?? TicketCategory.QUESTION,
      source: TicketSource.API,
      attachments: dto.attachments ?? null,
      firstResponseDueAt: sla.firstResponseDueAt,
      resolveDueAt: sla.resolveDueAt,
    });
    const saved = await this.ticketRepo.save(ticket);
    this.logger.log(`Ticket ingested via API: ${saved.ticketNumber} client=${apiKey.clientId}`);

    await this.notifyTicketCreated(saved, apiKey.clientId, false);
    return this.projectPublicTicket(saved);
  }

  /** Adds an external reply to a ticket the API key's client owns. */
  async ingestReply(
    apiKey: ClientApiKey,
    ticketId: string,
    dto: IngestReplyDto,
  ): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new ResourceNotFoundException('Ticket', ticketId);
    if (ticket.clientId !== apiKey.clientId) {
      throw new InsufficientPermissionsException('reply to this ticket');
    }
    if (ticket.status === TicketStatus.CLOSED) {
      throw new AppException('Cannot reply to a CLOSED ticket.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    await this.replyRepo.save(
      this.replyRepo.create({
        ticketId: ticket.id,
        authorId: null,
        authorName: dto.externalReporter ?? 'External (API)',
        body: dto.body,
        isInternal: false,
        attachments: dto.attachments ?? null,
      }),
    );
    if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.WAITING_CUSTOMER) {
      ticket.status = TicketStatus.OPEN;
      await this.ticketRepo.save(ticket);
    }
    await this.notifyReply(ticket, null, false, false);
    return this.projectPublicTicket(await this.ticketRepo.findOneOrFail({
      where: { id: ticket.id },
      relations: ['replies'],
    }));
  }

  /** Sanitized ticket projection returned to API callers (no internal notes). */
  private projectPublicTicket(ticket: Ticket): any {
    const replies = (ticket.replies ?? [])
      .filter((r) => !r.isInternal)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((r) => ({
        author: r.authorName,
        body: r.body,
        attachments: r.attachments,
        createdAt: r.createdAt,
      }));
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      createdAt: ticket.createdAt,
      replies,
    };
  }

  // ─── notifications ─────────────────────────────────────────────────────────
  private async notifyTicketCreated(
    ticket: Ticket,
    clientId: string,
    fromClient: boolean,
  ): Promise<void> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    // Notify the owning employee (and/or assignee) of a new ticket.
    const targets = new Set<string>();
    if (ticket.assigneeId) targets.add(ticket.assigneeId);
    if (client?.ownerId) targets.add(client.ownerId);
    for (const uid of targets) {
      void this.notificationService.createErpNotification(
        uid,
        NotificationType.TICKET_CREATED,
        'New Support Ticket',
        `Ticket ${ticket.ticketNumber}: ${ticket.subject}`,
        ticket.id,
      );
    }
    // If a staff member opened it on the client's behalf, notify the client.
    if (!fromClient && client?.userId) {
      void this.notificationService.createErpNotification(
        client.userId,
        NotificationType.TICKET_CREATED,
        'Support Ticket Opened',
        `Ticket ${ticket.ticketNumber} was opened for you.`,
        ticket.id,
      );
    }
  }

  private async notifyReply(
    ticket: Ticket,
    author: User | null,
    isInternal: boolean,
    fromStaff: boolean,
  ): Promise<void> {
    if (isInternal) return; // internal notes never notify the client
    const client = await this.clientRepo.findOne({ where: { id: ticket.clientId } });

    if (fromStaff) {
      // notify the client user
      if (client?.userId) {
        void this.notificationService.createErpNotification(
          client.userId,
          NotificationType.TICKET_REPLIED,
          'New Reply on Your Ticket',
          `Ticket ${ticket.ticketNumber} has a new reply.`,
          ticket.id,
        );
      }
    } else {
      // client/API reply → notify assignee + owner
      const targets = new Set<string>();
      if (ticket.assigneeId) targets.add(ticket.assigneeId);
      if (client?.ownerId) targets.add(client.ownerId);
      for (const uid of targets) {
        void this.notificationService.createErpNotification(
          uid,
          NotificationType.TICKET_REPLIED,
          'Customer Reply',
          `Ticket ${ticket.ticketNumber} has a new customer reply.`,
          ticket.id,
        );
      }
    }
  }

  private async notifyStatusChange(ticket: Ticket, prev: TicketStatus): Promise<void> {
    const client = await this.clientRepo.findOne({ where: { id: ticket.clientId } });
    if (client?.userId) {
      void this.notificationService.createErpNotification(
        client.userId,
        NotificationType.TICKET_STATUS,
        'Ticket Status Updated',
        `Ticket ${ticket.ticketNumber}: ${prev} → ${ticket.status}.`,
        ticket.id,
      );
    }
  }

  // ─── access control ───────────────────────────────────────────────────────────
  private async assertAccess(ticket: Ticket, user: User): Promise<void> {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.EMPLOYEE) {
      const owns =
        ticket.assigneeId === user.id ||
        (ticket.client && ticket.client.ownerId === user.id);
      if (!owns) throw new OwnershipViolationException();
      return;
    }
    if (user.role === UserRole.CLIENT) {
      const client = await this.requireClientForUser(user);
      if (ticket.clientId !== client.id) {
        throw new InsufficientPermissionsException('view this ticket');
      }
      return;
    }
    throw new InsufficientPermissionsException('access support');
  }
}
