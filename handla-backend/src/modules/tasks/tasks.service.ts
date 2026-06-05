import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, In } from 'typeorm';

import { Task } from './entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../auth/entities/user.entity';
import { UserRole, TaskStatus, NotificationType } from '../../common/enums';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksQueryDto } from './dto/tasks-query.dto';
import {
  ResourceNotFoundException,
  OwnershipViolationException,
  InsufficientPermissionsException,
  AppException,
} from '../../utils/exceptions';
import { NotificationService } from '../notifications/notification.service';
import { EmailService } from '../email/email.service';

export interface PaginatedTasks {
  tasks: Task[];
  total: number;
  page: number;
  pages: number;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,

    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
  ) {}

  // ─── findAll ──────────────────────────────────────────────────────────────────
  /**
   * Paginated list of tasks.
   * ADMIN: sees all tasks.
   * EMPLOYEE: sees tasks where ownerId === user.id OR assigneeId === user.id.
   * CLIENT: not permitted on this endpoint (controller @Roles handles it).
   * Supports filters: projectId, status, assigneeId, ownerId (ADMIN), search on title.
   */
  async findAll(user: User, query: TasksQueryDto): Promise<PaginatedTasks> {
    const { page = 1, limit = 20, projectId, status, assigneeId, ownerId, search, includeDelayed } = query;
    const skip = (page - 1) * limit;

    const qb = this.taskRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.project', 'p')
      .leftJoinAndSelect('t.assignee', 'a')
      .leftJoinAndSelect('t.owner', 'o')
      .orderBy('t.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    // Role-scoped filter: EMPLOYEE sees own (owner) or assigned tasks
    if (user.role === UserRole.EMPLOYEE) {
      qb.andWhere('(t.ownerId = :userId OR t.assigneeId = :userId)', { userId: user.id });
    }

    if (projectId) {
      qb.andWhere('t.projectId = :projectId', { projectId });
    }

    if (status) {
      qb.andWhere('t.status = :status', { status });
    } else if (includeDelayed) {
      qb.andWhere('t.status = :delayed', { delayed: TaskStatus.DELAYED });
    }

    // assigneeId filter (ADMIN can filter; for EMPLOYEE already scoped above)
    if (assigneeId && user.role === UserRole.ADMIN) {
      qb.andWhere('t.assigneeId = :assigneeId', { assigneeId });
    }

    // ownerId filter respected for ADMIN only
    if (ownerId && user.role === UserRole.ADMIN) {
      qb.andWhere('t.ownerId = :ownerId', { ownerId });
    }

    if (search) {
      qb.andWhere('t.title LIKE :search', { search: `%${search}%` });
    }

    const [tasks, total] = await qb.getManyAndCount();

    return {
      tasks,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ─── findOne ──────────────────────────────────────────────────────────────────
  /**
   * Fetch a single task by UUID.
   * EMPLOYEE: must own the task or be assigned to it.
   * CLIENT: can read tasks for projects linked to their client record
   *         (controller-level check — this method throws for CLIENT by default).
   * ADMIN: always allowed.
   */
  async findOne(id: string, user: User): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['project', 'project.client', 'assignee', 'owner'],
    });

    if (!task) {
      throw new ResourceNotFoundException('Task', id);
    }

    if (user.role === UserRole.EMPLOYEE) {
      if (task.ownerId !== user.id && task.assigneeId !== user.id) {
        throw new OwnershipViolationException();
      }
    }

    // CLIENT access: verify the task's project belongs to this user's client record
    if (user.role === UserRole.CLIENT) {
      // The project entity has a clientId; the client entity has userId
      const project = task.project;
      if (!project) {
        throw new InsufficientPermissionsException('access this task');
      }
      // project.client should be joined; fall through if null (no access)
      if (!project.client || project.client.userId !== user.id) {
        throw new InsufficientPermissionsException('access this task');
      }
    }

    return task;
  }

  // ─── findByProject ────────────────────────────────────────────────────────────
  /**
   * List all tasks for a specific project.
   * Used by the project detail page "Tasks" tab and the reusable TaskList component.
   * Access:
   *   - ADMIN: always allowed.
   *   - EMPLOYEE: must own the project.
   *   - CLIENT: must be the project's client's user.
   */
  async findByProject(projectId: string, user: User): Promise<Task[]> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['client'],
    });
    if (!project) {
      throw new ResourceNotFoundException('Project', projectId);
    }

    // EMPLOYEE: must own the project
    if (user.role === UserRole.EMPLOYEE && project.ownerId !== user.id) {
      throw new OwnershipViolationException();
    }

    // CLIENT: project must belong to their linked client
    if (user.role === UserRole.CLIENT) {
      if (!project.client || project.client.userId !== user.id) {
        throw new InsufficientPermissionsException("access this project's tasks");
      }
    }

    return this.taskRepo.find({
      where: { projectId },
      relations: ['project', 'assignee', 'owner'],
      order: { createdAt: 'DESC' },
    });
  }

  // ─── create ───────────────────────────────────────────────────────────────────
  /**
   * Create a new task under a project.
   * - Verifies projectId exists.
   * - EMPLOYEE: can only create for a project they own.
   * - assigneeId (optional): must reference a user with role EMPLOYEE.
   * - ownerId is always set to actingUser.id for EMPLOYEE; null for ADMIN unless explicit.
   * - Fires TASK_ASSIGNED notification if assigneeId is provided (placeholder — wired in ERP-9).
   */
  async create(dto: CreateTaskDto, actingUser: User): Promise<Task> {
    // Verify project exists
    const project = await this.projectRepo.findOne({ where: { id: dto.projectId } });
    if (!project) {
      throw new ResourceNotFoundException('Project', dto.projectId);
    }

    // EMPLOYEE must own the project
    if (actingUser.role === UserRole.EMPLOYEE && project.ownerId !== actingUser.id) {
      throw new AppException(
        `You do not own project ${dto.projectId}. EMPLOYEE can only create tasks for their own projects.`,
      );
    }

    // Validate assigneeId is an EMPLOYEE
    if (dto.assigneeId) {
      const assignee = await this.userRepo.findOne({ where: { id: dto.assigneeId } });
      if (!assignee) {
        throw new ResourceNotFoundException('User (assignee)', dto.assigneeId);
      }
      if (assignee.role !== UserRole.EMPLOYEE && assignee.role !== UserRole.ADMIN) {
        throw new AppException(
          `Assignee must be an EMPLOYEE user. User ${dto.assigneeId} has role ${assignee.role}.`,
        );
      }
    }

    const ownerId = actingUser.role === UserRole.EMPLOYEE ? actingUser.id : null;

    const task = this.taskRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      projectId: dto.projectId,
      assigneeId: dto.assigneeId ?? null,
      ownerId,
      status: dto.status ?? TaskStatus.PENDING,
      dueDate: dto.dueDate ?? null,
    });

    const saved = await this.taskRepo.save(task);
    this.logger.log(
      `Task created: id=${saved.id} projectId=${saved.projectId} ownerId=${saved.ownerId ?? 'none'} assigneeId=${saved.assigneeId ?? 'none'} by actor=${actingUser.id}`,
    );

    // ERP-9: Fire TASK_ASSIGNED notification if assigneeId is set
    if (saved.assigneeId) {
      void this.notificationService.createErpNotification(
        saved.assigneeId,
        NotificationType.TASK_ASSIGNED,
        'New Task Assigned',
        `You have been assigned to task "${saved.title}".`,
        saved.id,
      );

      // Queue email to assignee
      const assignee = await this.userRepo.findOne({ where: { id: saved.assigneeId } });
      if (assignee?.email) {
        void this.emailService.queueTaskAssigned({
          recipientEmail: assignee.email,
          recipientName:  assignee.name ?? 'Team Member',
          taskTitle:      saved.title,
          taskId:         saved.id,
          dueDate:        saved.dueDate ?? null,
          erpUrl: `${this.baseUrl}/erp/tasks/${saved.id}`,
        });
      }
    }

    return this.taskRepo.findOne({
      where: { id: saved.id },
      relations: ['project', 'project.client', 'assignee', 'owner'],
    }) as Promise<Task>;
  }

  // ─── update ───────────────────────────────────────────────────────────────────
  /**
   * Update mutable fields on a task.
   * EMPLOYEE: can update tasks they own or are assigned to.
   * ADMIN: can update any task.
   * Status transitions: any valid TaskStatus value is accepted here.
   * Delayed status is recalculated automatically by the scheduler.
   */
  async update(id: string, dto: UpdateTaskDto, user: User): Promise<Task> {
    const task = await this.findOne(id, user); // ownership check inside

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description ?? null;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate ?? null;
    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId !== null) {
        const assignee = await this.userRepo.findOne({ where: { id: dto.assigneeId } });
        if (!assignee) {
          throw new ResourceNotFoundException('User (assignee)', dto.assigneeId);
        }
        if (assignee.role !== UserRole.EMPLOYEE && assignee.role !== UserRole.ADMIN) {
          throw new AppException(
            `Assignee must be an EMPLOYEE user. User ${dto.assigneeId} has role ${assignee.role}.`,
          );
        }
      }
      task.assigneeId = dto.assigneeId ?? null;
    }

    // Only ADMIN can move a task to a different project
    if (dto.projectId !== undefined) {
      if (user.role !== UserRole.ADMIN) {
        throw new InsufficientPermissionsException('change task project (ADMIN only)');
      }
      const newProject = await this.projectRepo.findOne({ where: { id: dto.projectId } });
      if (!newProject) {
        throw new ResourceNotFoundException('Project', dto.projectId);
      }
      task.projectId = dto.projectId;
    }

    const updated = await this.taskRepo.save(task);
    this.logger.log(`Task updated: id=${id} by actor=${user.id}`);
    return this.taskRepo.findOne({
      where: { id: updated.id },
      relations: ['project', 'project.client', 'assignee', 'owner'],
    }) as Promise<Task>;
  }

  // ─── remove ───────────────────────────────────────────────────────────────────
  /**
   * Hard-delete a task. ADMIN only.
   */
  async remove(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) {
      throw new InsufficientPermissionsException('delete task records');
    }

    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) {
      throw new ResourceNotFoundException('Task', id);
    }

    await this.taskRepo.remove(task);
    this.logger.log(`Task hard-deleted: id=${id} by admin=${user.id}`);
  }

  // ─── recalculateDelayedStatus ─────────────────────────────────────────────────
  /**
   * Recalculate DELAYED status for overdue tasks.
   *
   * Design decision:
   *   We use a service-layer scheduled job (TasksScheduler calling this method) rather than
   *   a DB trigger or computed column. This approach allows us to:
   *     1. Fire TASK_DELAYED notifications to task owner and assignee for each newly-delayed task.
   *     2. Skip tasks that are already DELAYED (idempotent — no duplicate notifications).
   *     3. Keep the business logic testable without a live DB scheduler.
   *
   * @returns Count of tasks updated to DELAYED status.
   */
  async recalculateDelayedStatus(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all non-completed, non-delayed tasks whose due_date is before today
    const overdueTasks = await this.taskRepo.find({
      where: {
        status: Not(In([TaskStatus.COMPLETED, TaskStatus.DELAYED])),
        dueDate: LessThan(today.toISOString().split('T')[0]) as any,
      },
    });

    if (overdueTasks.length === 0) {
      this.logger.log('recalculateDelayedStatus: no overdue tasks found');
      return 0;
    }

    // Bulk update to DELAYED
    const ids = overdueTasks.map((t) => t.id);
    await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({ status: TaskStatus.DELAYED })
      .whereInIds(ids)
      .execute();

    this.logger.log(
      `recalculateDelayedStatus: marked ${ids.length} task(s) as DELAYED — ids=[${ids.join(', ')}]`,
    );

    // ERP-9: Fire TASK_DELAYED notifications for each newly-delayed task
    const fullTasks = await this.taskRepo.find({
      where: { id: In(ids) } as any,
      relations: ['owner', 'assignee'],
    });

    for (const task of fullTasks) {
      if (task.ownerId) {
        void this.notificationService.createErpNotification(
          task.ownerId,
          NotificationType.TASK_DELAYED,
          'Task Delayed',
          `Task "${task.title}" is past its due date.`,
          task.id,
        );
      }
      if (task.assigneeId && task.assigneeId !== task.ownerId) {
        void this.notificationService.createErpNotification(
          task.assigneeId,
          NotificationType.TASK_DELAYED,
          'Task Delayed',
          `Task "${task.title}" you are assigned to is past its due date.`,
          task.id,
        );

        // Queue email to assignee
        if (task.assignee?.email) {
          void this.emailService.queueTaskDelayed({
            recipientEmail: task.assignee.email,
            recipientName:  task.assignee.name ?? 'Team Member',
            taskTitle:      task.title,
            taskId:         task.id,
            dueDate:        task.dueDate ?? null,
            erpUrl: `${this.baseUrl}/erp/tasks/${task.id}`,
          });
        }
      }
    }

    return ids.length;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────
  private get baseUrl(): string {
    return process.env['BASE_URL'] ?? 'https://handla.com';
  }
}
