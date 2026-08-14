import { Injectable, Logger, Inject, forwardRef, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, ILike } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../auth/entities/user.entity';
import { UserRole, NotificationType } from '../../common/enums';
import { BCRYPT_ROUNDS } from '../../common/constants/security.constants';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notifications/notification.service';
import { ClientsService } from '../clients/clients.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import {
  ResourceNotFoundException,
  EmailAlreadyExistsException,
  RolePromotionException,
} from '../../utils/exceptions';

export interface PaginatedUsers {
  users: Omit<User, 'passwordHash'>[];
  total: number;
  page: number;
  pages: number;
}

// Role transitions that are explicitly forbidden via the updateRole endpoint.
// ADMIN demotion must never happen accidentally — a separate hard-delete /
// manual DB operation is required.
const FORBIDDEN_FROM_ROLES = new Set([UserRole.ADMIN]);

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ClientsService))
    private readonly clientsService: ClientsService,
  ) {}

  // ─── findAll ──────────────────────────────────────────────────────────────────
  /**
   * Paginated list of all users.
   * Supports optional role filter and name/email ILIKE search.
   * By default excludes archived users; pass isArchived=true to get the archive view.
   * Never returns passwordHash.
   */
  async findAll(query: UsersQueryDto): Promise<PaginatedUsers> {
    const { page = 1, limit = 20, role, search, withoutClientRecord, isArchived } = query;
    const skip = (page - 1) * limit;

    // Build base query — always select the archive/disable flags so the
    // frontend can show badges and the enable/disable toggle.
    const buildQb = (withArchiveFilter: boolean) => {
      const q = this.userRepo
        .createQueryBuilder('u')
        .select([
          'u.id', 'u.email', 'u.name', 'u.role',
          'u.isArchived', 'u.archivedAt', 'u.isDisabled',
          'u.createdAt', 'u.updatedAt',
        ])
        .orderBy('u.createdAt', 'DESC')
        .skip(skip)
        .take(limit);

      if (withArchiveFilter) {
        // isArchived=true  → show only archived rows
        // isArchived=false → show only active (non-archived) rows
        // Use raw integer literals; MySQL TINYINT(1) DEFAULT 0 means new rows
        // start as 0. COALESCE handles any row that was inserted before the
        // column existed (value would be NULL).
        if (isArchived) {
          q.andWhere('COALESCE(u.is_archived, 0) = 1');
        } else {
          q.andWhere('COALESCE(u.is_archived, 0) = 0');
        }
      }

      if (role)   q.andWhere('u.role = :role',   { role });
      if (search) q.andWhere('(u.name LIKE :search OR u.email LIKE :search)', { search: `%${search}%` });
      if (withoutClientRecord) {
        q.leftJoin('clients', 'c', 'c.user_id = u.id').andWhere('c.id IS NULL');
      }
      return q;
    };

    try {
      const [users, total] = await buildQb(true).getManyAndCount();
      this.logger.log(`findAll: ${total} users (isArchived=${isArchived ?? 'undefined'})`);
      return { users, total, page, pages: Math.ceil(total / limit) };
    } catch (err: unknown) {
      // Fallback: archive column doesn't exist yet — return all users unfiltered
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`findAll archive filter failed (${msg}) — falling back to unfiltered query`);
      const [users, total] = await buildQb(false).getManyAndCount();
      this.logger.log(`findAll fallback: ${total} users`);
      return { users, total, page, pages: Math.ceil(total / limit) };
    }
  }

  // ─── findOne ──────────────────────────────────────────────────────────────────
  /** Returns a single user by ID (no passwordHash). Throws 404 if not found. */
  async findOne(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.email', 'u.name', 'u.role', 'u.createdAt', 'u.updatedAt'])
      .where('u.id = :id', { id })
      .getOne();

    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    return user;
  }

  // ─── createUser ───────────────────────────────────────────────────────────────
  /**
   * ADMIN creates a new user with an explicit role.
   * If role=CLIENT, a Client record is auto-created so the user appears in the
   * Clients module immediately without requiring a manual two-step flow.
   * Sends a "user-created" welcome email via the email queue.
   */
  async createUser(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new EmailAlreadyExistsException(dto.email);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      name: dto.name,
      role: dto.role,
    });

    const saved = await this.userRepo.save(user);
    this.logger.log(`ADMIN created user ${saved.id} (${saved.email}) with role ${saved.role}`);

    // Auto-create Client record when role=CLIENT so the user is immediately
    // visible in the Clients module without a manual second step.
    // NOTE: must be awaited (not fire-and-forget) so the Client record exists
    // by the time the frontend does a follow-up GET /erp/clients request.
    if (saved.role === UserRole.CLIENT) {
      try {
        await this.clientsService.createFromLeadPromotion(saved.id, null);
      } catch (err: any) {
        this.logger.error(`Failed to auto-create Client record for new CLIENT user ${saved.id}: ${err.message}`);
      }
    }

    // Fire-and-forget: queue welcome / account-created email.
    // Must NOT be awaited — email queue failures must never delay or fail the
    // user-creation response. Use void + .catch() to keep it truly async.
    const dashboardUrl =
      saved.role === UserRole.ADMIN || saved.role === UserRole.EMPLOYEE
        ? `${process.env.BASE_URL ?? 'https://handla.com'}/erp`
        : `${process.env.BASE_URL ?? 'https://handla.com'}/dashboard`;

    void this.emailService
      .queueUserCreatedEmail({
        recipientEmail: saved.email,
        userName: saved.name,
        temporaryPassword: dto.password,
        dashboardUrl,
      })
      .catch((err) => {
        // Email failure must never break user creation
        this.logger.error(`Failed to queue user-created email for ${saved.email}: ${err.message}`);
      });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...safeUser } = saved;
    return safeUser as Omit<User, 'passwordHash'>;
  }

  // ─── updateUser ───────────────────────────────────────────────────────────────
  /**
   * ADMIN can update a user's name and/or email.
   * Email must remain unique. ADMIN's own name/email cannot be changed via this
   * endpoint to prevent accidental lockout.
   */
  async updateUser(
    userId: string,
    dto: { name?: string; email?: string },
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new ResourceNotFoundException('User', userId);

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const conflict = await this.userRepo.findOne({
        where: { email: dto.email.toLowerCase() },
      });
      if (conflict) throw new EmailAlreadyExistsException(dto.email);
      user.email = dto.email.toLowerCase();
    }

    if (dto.name) user.name = dto.name;

    const saved = await this.userRepo.save(user);
    this.logger.log(`User updated: ${userId} (${saved.email})`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...safeUser } = saved as any;
    return safeUser as Omit<User, 'passwordHash'>;
  }

  // ─── resetPassword ────────────────────────────────────────────────────────────
  /**
   * ADMIN resets a user's password to a new value.
   */
  async resetPassword(
    userId: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new ResourceNotFoundException('User', userId);

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userRepo.save(user);
    this.logger.log(`Password reset for user: ${userId} (${user.email})`);
  }

  // ─── updateRole ───────────────────────────────────────────────────────────────
  /**
   * Update a user's role.
   * Throws RolePromotionException if trying to demote an ADMIN.
   */
  async updateRole(userId: string, dto: UpdateUserRoleDto): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }

    // Prevent demotion of ADMIN accounts via this endpoint
    if (FORBIDDEN_FROM_ROLES.has(user.role) && dto.role !== UserRole.ADMIN) {
      throw new RolePromotionException(
        'ADMIN role cannot be changed via this endpoint. Use direct DB migration for role changes on admin accounts.',
      );
    }

    const previousRole = user.role;
    user.role = dto.role;
    const updated = await this.userRepo.save(user);

    this.logger.log(`Role change: user ${userId} (${user.email}): ${previousRole} → ${dto.role}`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...safeUser } = updated;
    return safeUser as Omit<User, 'passwordHash'>;
  }

  // ─── promoteLeadToClient ──────────────────────────────────────────────────────
  /**
   * Promote a LEAD user to CLIENT.
   * Throws RolePromotionException if the user is not currently LEAD.
   */
  async promoteLeadToClient(
    leadId: string,
    actingAdmin: User,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id: leadId } });

    if (!user) {
      throw new ResourceNotFoundException('User', leadId);
    }

    if (user.role !== UserRole.LEAD) {
      throw new RolePromotionException(
        `Cannot promote user ${leadId}: current role is ${user.role}, expected LEAD`,
      );
    }

    user.role = UserRole.CLIENT;
    const promoted = await this.userRepo.save(user);

    this.logger.log(
      `LEAD → CLIENT promotion: user ${leadId} (${user.email}) by admin ${actingAdmin.id}`,
    );

    // ── ERP-3: Auto-create Client record ────────────────────────────────────────
    // Find the assigned_employee_id from the lead's conversation (if any).
    // This is the EMPLOYEE that will own the new Client record.
    let ownerIdForNotification: string | null = null;
    try {
      const conversation = await this.userRepo.manager.query(
        `SELECT assigned_employee_id FROM conversations WHERE client_id = ? LIMIT 1`,
        [leadId],
      );
      const ownerId: string | null = conversation[0]?.assigned_employee_id ?? null;
      ownerIdForNotification = ownerId;

      await this.clientsService.createFromLeadPromotion(leadId, ownerId);
    } catch (err: unknown) {
      // Client record creation must never block the promotion itself
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to auto-create Client record for ${leadId} after LEAD→CLIENT promotion: ${msg}`,
      );
    }

    // ERP-9: LEAD_PROMOTED — notify the assigned EMPLOYEE (if any)
    if (ownerIdForNotification) {
      void this.notificationService.createErpNotification(
        ownerIdForNotification,
        NotificationType.LEAD_PROMOTED,
        'Lead Promoted to Client',
        `${user.name} has been promoted to CLIENT and is now assigned to you.`,
        leadId,
      );

      const employeeUser = await this.userRepo.findOne({ where: { id: ownerIdForNotification } });
      if (employeeUser?.email) {
        void this.emailService.queueLeadPromoted({
          recipientEmail: employeeUser.email,
          recipientName:  employeeUser.name ?? 'Employee',
          clientName:     user.name,
          clientId:       leadId,
          erpUrl: `${process.env['BASE_URL'] ?? 'https://handla.com'}/erp/clients`,
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...safeUser } = promoted;
    return safeUser as Omit<User, 'passwordHash'>;
  }

  // ─── reassignOwnership ────────────────────────────────────────────────────────
  /**
   * Bulk-reassign all ERP records owned by `currentOwnerId` to `newOwnerId`.
   *
   * Runs inside a DB transaction. At ERP-2 stage the only "owned" column
   * that exists is `conversations.assigned_employee_id`. Later ERP phases
   * (Clients, Projects, Tasks, etc.) will add their own tables; this method
   * is designed so each table is updated with one UPDATE statement, making
   * it trivially extensible.
   *
   * Validates that:
   *   - `currentOwnerId` user exists
   *   - `newOwnerId` user exists AND is EMPLOYEE
   */
  async reassignOwnership(
    currentOwnerId: string,
    newOwnerId: string,
  ): Promise<{ reassigned: Record<string, number> }> {
    // Pre-flight checks (outside transaction so errors are fast)
    const [currentOwner, newOwner] = await Promise.all([
      this.userRepo.findOne({ where: { id: currentOwnerId } }),
      this.userRepo.findOne({ where: { id: newOwnerId } }),
    ]);

    if (!currentOwner) {
      throw new ResourceNotFoundException('User (current owner)', currentOwnerId);
    }
    if (!newOwner) {
      throw new ResourceNotFoundException('User (new owner)', newOwnerId);
    }
    if (newOwner.role !== UserRole.EMPLOYEE) {
      throw new RolePromotionException(
        `Target user ${newOwnerId} must have role EMPLOYEE (found: ${newOwner.role})`,
      );
    }

    const counts: Record<string, number> = {};

    await this.userRepo.manager.transaction(async (em: EntityManager) => {
      // ── conversations.assigned_employee_id ──────────────────────────────────
      const convResult = await em
        .createQueryBuilder()
        .update('conversations')
        .set({ assigned_employee_id: newOwnerId })
        .where('assigned_employee_id = :currentOwnerId', { currentOwnerId })
        .execute();
      counts['conversations'] = convResult.affected ?? 0;

      // ── ERP-3: clients.owner_id ─────────────────────────────────────────────
      const clientsResult = await em
        .createQueryBuilder()
        .update('clients')
        .set({ owner_id: newOwnerId })
        .where('owner_id = :currentOwnerId', { currentOwnerId })
        .execute();
      counts['clients'] = clientsResult.affected ?? 0;

      // ── Future tables (Projects, Tasks, Contracts, Invoices, Expenses)
      // will be added here in their respective ERP phases. Each follows the same
      // pattern: one UPDATE … WHERE owner_id = :currentOwnerId statement.
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    this.logger.log(
      `Ownership reassigned: ${currentOwnerId} → ${newOwnerId} | ` +
        Object.entries(counts)
          .map(([t, n]) => `${t}: ${n}`)
          .join(', ') +
        ` | total: ${total}`,
    );

    return { reassigned: counts };
  }

  // ─── deleteUser ───────────────────────────────────────────────────────────────
  /**
   * Hard-delete a user by ID.
   * All related DB records that have ON DELETE CASCADE will be removed.
   * The caller (controller) MUST verify the actor is not deleting themselves.
   */
  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }

    await this.userRepo.remove(user);
    this.logger.log(`User hard-deleted: ${userId} (${user.email})`);
  }

  // ─── archiveUser ──────────────────────────────────────────────────────────────
  /**
   * Soft-archive a user.
   *
   * Sets isArchived=true and records archivedAt timestamp.
   * The user row and ALL related records (invoices, projects, clients,
   * conversations, etc.) are fully preserved in the database.
   * Archived users are excluded from normal list views but accessible via
   * the admin archive view (GET /users?isArchived=true).
   * An archived user also cannot log in (isArchived implies disabled login).
   */
  async archiveUser(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('ADMIN accounts cannot be archived');
    }

    user.isArchived = true;
    user.archivedAt = user.archivedAt ?? new Date(); // preserve original archive date if re-archived
    user.isDisabled = true; // archived users also cannot log in

    const saved = await this.userRepo.save(user);
    this.logger.log(`User archived: ${userId} (${user.email})`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...safeUser } = saved as any;
    return safeUser as Omit<User, 'passwordHash'>;
  }

  // ─── disableUser ──────────────────────────────────────────────────────────────
  /**
   * Disable a user account so they cannot sign in.
   * All records remain intact; the user simply cannot authenticate.
   */
  async disableUser(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('ADMIN accounts cannot be disabled');
    }

    user.isDisabled = true;
    const saved = await this.userRepo.save(user);
    this.logger.log(`User disabled: ${userId} (${user.email})`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...safeUser } = saved as any;
    return safeUser as Omit<User, 'passwordHash'>;
  }

  // ─── enableUser ───────────────────────────────────────────────────────────────
  /**
   * Re-enable a previously disabled user account so they can sign in again.
   * Has no effect on archived users (isArchived flag is independent).
   */
  async enableUser(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }

    user.isDisabled = false;
    const saved = await this.userRepo.save(user);
    this.logger.log(`User enabled: ${userId} (${user.email})`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...safeUser } = saved as any;
    return safeUser as Omit<User, 'passwordHash'>;
  }

  // ─── unarchiveUser ────────────────────────────────────────────────────────────
  /**
   * Restore an archived user back to active status.
   * Clears isArchived, archivedAt, and also re-enables login.
   */
  async unarchiveUser(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }

    user.isArchived = false;
    user.archivedAt = null;
    user.isDisabled = false;
    const saved = await this.userRepo.save(user);
    this.logger.log(`User unarchived: ${userId} (${user.email})`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...safeUser } = saved as any;
    return safeUser as Omit<User, 'passwordHash'>;
  }
}
