import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Client } from './entities/client.entity';
import { User } from '../auth/entities/user.entity';
import { Conversation } from '../chat/entities/conversation.entity';
import { UserRole, ClientStatus, NotificationType } from '../../common/enums';
import { CreateClientDto } from './dto/create-client.dto';
import { ProvisionClientDto } from './dto/provision-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientsQueryDto } from './dto/clients-query.dto';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  EmailAlreadyExistsException,
  AppException,
} from '../../utils/exceptions';
import { BCRYPT_ROUNDS } from '../../common/constants/security.constants';
import { NotificationService } from '../notifications/notification.service';
import { EmailService } from '../email/email.service';

export interface PaginatedClients {
  clients: Client[];
  total: number;
  page: number;
  pages: number;
}

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
  ) {}

  // ─── findAll ──────────────────────────────────────────────────────────────────
  /**
   * Paginated list of clients.
   * ADMIN: sees all. EMPLOYEE: sees only clients where ownerId === user.id.
   * Optionally filter by status, ownerId, or search on user name / company.
   */
  async findAll(user: User, query: ClientsQueryDto): Promise<PaginatedClients> {
    const { page = 1, limit = 20, status, search, ownerId } = query;
    const skip = (page - 1) * limit;

    const qb = this.clientRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .leftJoinAndSelect('c.owner', 'o')
      .orderBy('c.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    // Role-scoped ownership filter
    if (user.role === UserRole.EMPLOYEE) {
      qb.andWhere('c.ownerId = :userId', { userId: user.id });
    }

    if (status) {
      qb.andWhere('c.status = :status', { status });
    }

    if (ownerId && user.role === UserRole.ADMIN) {
      qb.andWhere('c.ownerId = :ownerId', { ownerId });
    }

    if (search) {
      qb.andWhere('(u.name LIKE :search OR c.company LIKE :search)', { search: `%${search}%` });
    }

    const [clients, total] = await qb.getManyAndCount();

    return {
      clients,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ─── findOne ──────────────────────────────────────────────────────────────────
  /**
   * Fetch a single client by its UUID.
   * EMPLOYEE ownership is enforced — throws OwnershipViolationException if not owner.
   */
  async findOne(id: string, user: User): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id },
      relations: ['user', 'owner'],
    });

    if (!client) {
      throw new ResourceNotFoundException('Client', id);
    }

    if (user.role === UserRole.EMPLOYEE && client.ownerId !== user.id) {
      throw new OwnershipViolationException();
    }

    return client;
  }

  // ─── findByUserId ─────────────────────────────────────────────────────────────
  /**
   * Retrieve the Client record that belongs to the given userId.
   * Used by the CLIENT-role "me" endpoint.
   */
  async findByUserId(userId: string): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { userId },
      relations: ['user', 'owner'],
    });
    if (!client) {
      throw new ResourceNotFoundException('Client record for user', userId);
    }
    return client;
  }

  // ─── create ───────────────────────────────────────────────────────────────────
  /**
   * Create a Client record for an existing User (role=CLIENT).
   * - Validates the target user has role=CLIENT.
   * - Throws AppException if a Client record already exists for that user.
   * - EMPLOYEE acting user → ownerId set to actingUser.id.
   * - ADMIN acting user → ownerId is optional (null if not provided).
   */
  async create(dto: CreateClientDto, actingUser: User): Promise<Client> {
    // Verify target user exists and is a CLIENT
    const targetUser = await this.userRepo.findOne({ where: { id: dto.userId } });

    if (!targetUser) {
      throw new ResourceNotFoundException('User', dto.userId);
    }

    if (targetUser.role !== UserRole.CLIENT) {
      throw new AppException(
        `User ${dto.userId} must have role CLIENT (current role: ${targetUser.role})`,
      );
    }

    // Prevent duplicate Client records for the same user
    const existing = await this.clientRepo.findOne({
      where: { userId: dto.userId },
    });

    if (existing) {
      throw new AppException(`A Client record already exists for user ${dto.userId}`);
    }

    const ownerId = actingUser.role === UserRole.EMPLOYEE ? actingUser.id : null;

    const client = this.clientRepo.create({
      userId: dto.userId,
      ownerId,
      company: dto.company ?? null,
      status: dto.status ?? ClientStatus.ACTIVE,
      notes: dto.notes ?? null,
    });

    const saved = await this.clientRepo.save(client);
    this.logger.log(
      `Client created: id=${saved.id} userId=${saved.userId} ownerId=${saved.ownerId ?? 'none'} by actor=${actingUser.id}`,
    );

    return this.clientRepo.findOne({
      where: { id: saved.id },
      relations: ['user', 'owner'],
    }) as Promise<Client>;
  }

  // ─── provision ──────────────────────────────────────────────────────────────────
  /**
   * Create a brand-new CLIENT user AND its Client record in a single atomic call.
   *
   * Why this exists: onboarding a new client previously required creating the
   * user via the ADMIN-only /users controller, then polling /erp/clients for the
   * auto-created record and patching it. That flow 403'd EMPLOYEEs and was racy.
   * This endpoint lives on the (ADMIN+EMPLOYEE) clients controller, so any staff
   * member can onboard a client without touching /users, and the user + client
   * are committed together in one transaction.
   *
   * EMPLOYEE actor → the new client is owned by them (ownerId = actor.id).
   * ADMIN actor    → ownerId is null (unassigned) unless later assigned.
   */
  async provision(dto: ProvisionClientDto, actingUser: User): Promise<Client> {
    const email = dto.email.toLowerCase();

    // Reject duplicate emails up-front (unique user constraint).
    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (existingUser) {
      throw new EmailAlreadyExistsException(dto.email);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const ownerId = actingUser.role === UserRole.EMPLOYEE ? actingUser.id : null;

    // Create the CLIENT user + Client record atomically so we never leave a
    // dangling user without a client record (or vice-versa) on partial failure.
    const savedClientId = await this.clientRepo.manager.transaction(
      async (manager: EntityManager) => {
        const user = manager.create(User, {
          email,
          passwordHash,
          name: dto.name.trim(),
          role: UserRole.CLIENT,
        });
        const savedUser = await manager.save(user);

        const client = manager.create(Client, {
          userId: savedUser.id,
          ownerId,
          company: dto.company?.trim() || null,
          status: dto.status ?? ClientStatus.ACTIVE,
          notes: dto.notes?.trim() || null,
        });
        const savedClient = await manager.save(client);
        return savedClient.id;
      },
    );

    this.logger.log(
      `Client provisioned (user+record) id=${savedClientId} email=${email} ownerId=${ownerId ?? 'none'} by actor=${actingUser.id}`,
    );

    // Fire-and-forget welcome email — must never fail/delay the response.
    const dashboardUrl = `${this.baseUrl}/dashboard`;
    void this.emailService
      .queueUserCreatedEmail({
        recipientEmail: email,
        userName: dto.name.trim(),
        temporaryPassword: dto.password,
        dashboardUrl,
      })
      .catch((err: any) => {
        this.logger.error(
          `Failed to queue user-created email for provisioned client ${email}: ${err.message}`,
        );
      });

    return this.clientRepo.findOne({
      where: { id: savedClientId },
      relations: ['user', 'owner'],
    }) as Promise<Client>;
  }

  // ─── update ───────────────────────────────────────────────────────────────────
  /**
   * Update mutable fields on a Client record.
   * EMPLOYEE: can only update records they own.
   * ADMIN: can update any.
   */
  async update(id: string, dto: UpdateClientDto, user: User): Promise<Client> {
    const client = await this.findOne(id, user); // ownership check inside

    if (dto.company !== undefined) client.company = dto.company ?? null;
    if (dto.status !== undefined) client.status = dto.status;
    if (dto.notes !== undefined) client.notes = dto.notes ?? null;

    const updated = await this.clientRepo.save(client);
    this.logger.log(`Client updated: id=${id} by actor=${user.id}`);
    return updated;
  }

  // ─── remove ───────────────────────────────────────────────────────────────────
  /**
   * Hard-delete a Client record. ADMIN only.
   * CASCADE on the FK will propagate to Projects, Contracts, Invoices etc.
   */
  async remove(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) {
      throw new InsufficientPermissionsException('delete client records');
    }

    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) {
      throw new ResourceNotFoundException('Client', id);
    }

    await this.clientRepo.remove(client);
    this.logger.log(`Client hard-deleted: id=${id} by admin=${user.id}`);
  }

  // ─── assignOwner ──────────────────────────────────────────────────────────────
  /**
   * Reassign the owning EMPLOYEE of a client. ADMIN only.
   * Also updates conversations.assigned_employee_id for any conversation
   * belonging to the client's user.
   */
  async assignOwner(clientId: string, newOwnerId: string, admin: User): Promise<Client> {
    if (admin.role !== UserRole.ADMIN) {
      throw new InsufficientPermissionsException('assign client owner');
    }

    const client = await this.clientRepo.findOne({
      where: { id: clientId },
      relations: ['user'],
    });

    if (!client) {
      throw new ResourceNotFoundException('Client', clientId);
    }

    // Verify new owner exists and is an EMPLOYEE
    const newOwner = await this.userRepo.findOne({ where: { id: newOwnerId } });
    if (!newOwner) {
      throw new ResourceNotFoundException('User (new owner)', newOwnerId);
    }

    if (newOwner.role !== UserRole.EMPLOYEE) {
      throw new AppException(
        `User ${newOwnerId} must have role EMPLOYEE (found: ${newOwner.role})`,
      );
    }

    const previousOwnerId = client.ownerId;
    client.ownerId = newOwnerId;
    const updated = await this.clientRepo.save(client);

    // ── Update conversations.assigned_employee_id for client's conversations ──
    await this.clientRepo.manager.transaction(async (em: EntityManager) => {
      await em
        .createQueryBuilder()
        .update(Conversation)
        .set({ assignedEmployeeId: newOwnerId })
        .where('clientId = :clientUserId', { clientUserId: client.userId })
        .execute();
    });

    this.logger.log(
      `Client owner reassigned: clientId=${clientId} ${previousOwnerId ?? 'none'} → ${newOwnerId} by admin=${admin.id}`,
    );

    // ERP-9: LEAD_ASSIGNED — notify the new owner (EMPLOYEE)
    void this.notificationService.createErpNotification(
      newOwnerId,
      NotificationType.LEAD_ASSIGNED,
      'Client Assigned to You',
      `Client ${client.user?.name ?? clientId} has been assigned to you.`,
      clientId,
    );

    // Queue email to the new employee owner
    if (newOwner.email) {
      void this.emailService.queueLeadAssigned({
        recipientEmail: newOwner.email,
        recipientName:  newOwner.name ?? 'Employee',
        clientName:     client.user?.name ?? 'Client',
        clientId,
        erpUrl: `${this.baseUrl}/erp/clients/${clientId}`,
      });
    }

    return this.clientRepo.findOne({
      where: { id: clientId },
      relations: ['user', 'owner'],
    }) as Promise<Client>;
  }

  // ─── createFromLeadPromotion ──────────────────────────────────────────────────
  /**
   * Internal method — called automatically after UsersService.promoteLeadToClient().
   *
   * Creates a Client record for the newly-promoted CLIENT user, carrying forward
   * the ownerId from the conversation's assigned_employee_id (if available).
   *
   * This is intentionally a fire-and-continue operation: if no conversation exists
   * (edge case) the Client record is still created with ownerId=null.
   */
  async createFromLeadPromotion(leadUserId: string, ownerId: string | null): Promise<Client> {
    // Guard: don't create a duplicate
    const existing = await this.clientRepo.findOne({
      where: { userId: leadUserId },
    });

    if (existing) {
      this.logger.warn(
        `createFromLeadPromotion: Client record already exists for userId=${leadUserId}; skipping.`,
      );
      return existing;
    }

    const client = this.clientRepo.create({
      userId: leadUserId,
      ownerId: ownerId ?? null,
      status: ClientStatus.ACTIVE,
    });

    const saved = await this.clientRepo.save(client);
    this.logger.log(
      `Client record auto-created from LEAD promotion: id=${saved.id} userId=${leadUserId} ownerId=${ownerId ?? 'none'}`,
    );
    return saved;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────
  private get baseUrl(): string {
    return process.env['BASE_URL'] ?? 'https://handla.com';
  }
}
