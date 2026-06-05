import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Project } from './entities/project.entity';
import { Client } from '../clients/entities/client.entity';
import { User } from '../auth/entities/user.entity';
import { UserRole, ProjectStatus } from '../../common/enums';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsQueryDto } from './dto/projects-query.dto';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../utils/exceptions';
import { ChatService } from '../chat/chat.service';
import { Conversation } from '../chat/entities/conversation.entity';

export interface PaginatedProjects {
  projects: Project[];
  total: number;
  page: number;
  pages: number;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,

    private readonly chatService: ChatService,
  ) {}

  // ─── findAll ──────────────────────────────────────────────────────────────────
  /**
   * Paginated list of projects.
   * ADMIN: sees all. EMPLOYEE: sees only projects where ownerId === user.id.
   * CLIENT: not permitted on this endpoint (handled by controller @Roles).
   * Supports filtering by clientId, status, ownerId (ADMIN), and title search.
   */
  async findAll(user: User, query: ProjectsQueryDto): Promise<PaginatedProjects> {
    const { page = 1, limit = 20, clientId, status, ownerId, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.projectRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.client', 'c')
      .leftJoinAndSelect('c.user', 'cu')
      .leftJoinAndSelect('p.owner', 'o')
      .orderBy('p.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    // Role-scoped ownership filter
    if (user.role === UserRole.EMPLOYEE) {
      qb.andWhere('p.ownerId = :userId', { userId: user.id });
    }

    if (clientId) {
      qb.andWhere('p.clientId = :clientId', { clientId });
    }

    if (status) {
      qb.andWhere('p.status = :status', { status });
    }

    // ownerId filter is only respected for ADMIN (EMPLOYEE is already scoped)
    if (ownerId && user.role === UserRole.ADMIN) {
      qb.andWhere('p.ownerId = :ownerId', { ownerId });
    }

    if (search) {
      qb.andWhere('p.title LIKE :search', { search: `%${search}%` });
    }

    const [projects, total] = await qb.getManyAndCount();

    return {
      projects,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ─── findOne ──────────────────────────────────────────────────────────────────
  /**
   * Fetch a single project by UUID.
   * EMPLOYEE ownership is enforced.
   * CLIENT can read projects linked to their client record (checked by controller).
   */
  async findOne(id: string, user: User): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['client', 'client.user', 'owner'],
    });

    if (!project) {
      throw new ResourceNotFoundException('Project', id);
    }

    if (user.role === UserRole.EMPLOYEE && project.ownerId !== user.id) {
      throw new OwnershipViolationException();
    }

    // CLIENT access: verify the project's client belongs to this user
    if (user.role === UserRole.CLIENT) {
      const clientRecord = await this.clientRepo.findOne({
        where: { userId: user.id },
      });
      if (!clientRecord || project.clientId !== clientRecord.id) {
        throw new InsufficientPermissionsException('access this project');
      }
    }

    return project;
  }

  // ─── create ───────────────────────────────────────────────────────────────────
  /**
   * Create a new project under a client.
   * - Verifies the clientId exists.
   * - EMPLOYEE: can only create for a client they own; ownerId auto-set to actingUser.id.
   * - ADMIN: can create for any client; ownerId is optional (null if not provided).
   */
  async create(dto: CreateProjectDto, actingUser: User): Promise<Project> {
    // Verify client exists
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    if (!client) {
      throw new ResourceNotFoundException('Client', dto.clientId);
    }

    // EMPLOYEE ownership check on the client
    if (actingUser.role === UserRole.EMPLOYEE && client.ownerId !== actingUser.id) {
      throw new AppException(
        `You do not own client ${dto.clientId}. EMPLOYEE can only create projects for their own clients.`,
      );
    }

    const ownerId = actingUser.role === UserRole.EMPLOYEE ? actingUser.id : null;

    const project = this.projectRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      clientId: dto.clientId,
      ownerId,
      status: dto.status ?? ProjectStatus.PLANNING,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
    });

    const saved = await this.projectRepo.save(project);
    this.logger.log(
      `Project created: id=${saved.id} clientId=${saved.clientId} ownerId=${saved.ownerId ?? 'none'} by actor=${actingUser.id}`,
    );

    // Post a system event card in the client's chat conversation (fire-and-forget)
    void (async () => {
      try {
        const conversation = await this.conversationRepo.findOne({
          where: { clientId: client.userId },
          order: { createdAt: 'DESC' },
        });
        if (conversation) {
          const messageContent = `__SYSTEM__:${JSON.stringify({
            type:    'PROJECT_CREATED',
            title:   saved.title,
            id:      saved.id,
            status:  saved.status,
            message: 'A new project has been created for you.',
          })}`;
          await this.chatService.saveMessage(
            conversation.id,
            actingUser.id,
            messageContent,
          );
        }
      } catch (err) {
        this.logger.warn(`Failed to post project chat message: ${(err as Error).message}`);
      }
    })();

    return this.projectRepo.findOne({
      where: { id: saved.id },
      relations: ['client', 'client.user', 'owner'],
    }) as Promise<Project>;
  }

  // ─── update ───────────────────────────────────────────────────────────────────
  /**
   * Update mutable fields on a project.
   * EMPLOYEE: can only update projects they own.
   * ADMIN: can update any project.
   */
  async update(id: string, dto: UpdateProjectDto, user: User): Promise<Project> {
    const project = await this.findOne(id, user); // ownership check inside

    if (dto.title !== undefined) project.title = dto.title;
    if (dto.description !== undefined) project.description = dto.description ?? null;
    if (dto.status !== undefined) project.status = dto.status;
    if (dto.startDate !== undefined) project.startDate = dto.startDate ?? null;
    if (dto.endDate !== undefined) project.endDate = dto.endDate ?? null;

    // Only ADMIN can move a project to a different client
    if (dto.clientId !== undefined) {
      if (user.role !== UserRole.ADMIN) {
        throw new InsufficientPermissionsException('change project client (ADMIN only)');
      }
      const newClient = await this.clientRepo.findOne({ where: { id: dto.clientId } });
      if (!newClient) {
        throw new ResourceNotFoundException('Client', dto.clientId);
      }
      project.clientId = dto.clientId;
    }

    const updated = await this.projectRepo.save(project);
    this.logger.log(`Project updated: id=${id} by actor=${user.id}`);
    return this.projectRepo.findOne({
      where: { id: updated.id },
      relations: ['client', 'client.user', 'owner'],
    }) as Promise<Project>;
  }

  // ─── remove ───────────────────────────────────────────────────────────────────
  /**
   * Hard-delete a project. ADMIN only.
   * CASCADE on the FK will propagate to Tasks.
   */
  async remove(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) {
      throw new InsufficientPermissionsException('delete project records');
    }

    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) {
      throw new ResourceNotFoundException('Project', id);
    }

    await this.projectRepo.remove(project);
    this.logger.log(`Project hard-deleted: id=${id} by admin=${user.id}`);
  }

  // ─── findByClient ─────────────────────────────────────────────────────────────
  /**
   * List all projects for a specific client.
   * Used by the client detail page "Projects" tab.
   * Access rules:
   *   - ADMIN: always allowed.
   *   - EMPLOYEE: must own the client.
   *   - CLIENT: must be the client's own user record.
   */
  async findByClient(clientId: string, user: User): Promise<Project[]> {
    // Verify the client exists
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) {
      throw new ResourceNotFoundException('Client', clientId);
    }

    // Access control
    if (user.role === UserRole.EMPLOYEE && client.ownerId !== user.id) {
      throw new OwnershipViolationException();
    }

    if (user.role === UserRole.CLIENT) {
      const myClientRecord = await this.clientRepo.findOne({
        where: { userId: user.id },
      });
      if (!myClientRecord || myClientRecord.id !== clientId) {
        throw new InsufficientPermissionsException('access this client\'s projects');
      }
    }

    return this.projectRepo.find({
      where: { clientId },
      relations: ['client', 'client.user', 'owner'],
      order: { createdAt: 'DESC' },
    });
  }

  // ─── findByUserId ─────────────────────────────────────────────────────────────
  /**
   * List all projects for the CLIENT user identified by userId.
   * Used by GET /erp/projects/my endpoint.
   */
  async findByUserId(userId: string): Promise<Project[]> {
    const clientRecord = await this.clientRepo.findOne({ where: { userId } });
    if (!clientRecord) {
      throw new ResourceNotFoundException('Client record for user', userId);
    }
    return this.projectRepo.find({
      where: { clientId: clientRecord.id },
      relations: ['client', 'client.user', 'owner'],
      order: { createdAt: 'DESC' },
    });
  }
}
