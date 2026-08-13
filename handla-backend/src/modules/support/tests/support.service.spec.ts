import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';

import { SupportService } from '../support.service';
import { Ticket } from '../entities/ticket.entity';
import { TicketReply } from '../entities/ticket-reply.entity';
import { ClientApiKey } from '../entities/client-api-key.entity';
import { Client } from '../../clients/entities/client.entity';
import { Project } from '../../projects/entities/project.entity';
import { NotificationService } from '../../notifications/notification.service';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketSource,
  UserRole,
} from '../../../common/enums';
import { User } from '../../auth/entities/user.entity';

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u-1', role: UserRole.ADMIN, name: 'Admin', ...overrides } as User;
}

function buildQb(overrides: Record<string, any> = {}) {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ max: null }),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return qb;
}

describe('SupportService', () => {
  let service: SupportService;
  let ticketRepo: any;
  let replyRepo: any;
  let apiKeyRepo: any;
  let clientRepo: any;
  let projectRepo: any;
  let notificationService: any;

  beforeEach(async () => {
    ticketRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: x.id ?? 't-1', ...x })),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      remove: jest.fn(),
    };
    replyRepo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve(x)),
    };
    apiKeyRepo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'k-1', ...x })),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    };
    clientRepo = { findOne: jest.fn() };
    projectRepo = { findOne: jest.fn() };
    notificationService = { createErpNotification: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: getRepositoryToken(TicketReply), useValue: replyRepo },
        { provide: getRepositoryToken(ClientApiKey), useValue: apiKeyRepo },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get(SupportService);
  });

  describe('generateTicketNumber', () => {
    it('starts at 0001 when none exist', async () => {
      const year = new Date().getFullYear();
      expect(await service.generateTicketNumber()).toBe(`TKT-${year}-0001`);
    });

    it('increments from the max', async () => {
      const year = new Date().getFullYear();
      ticketRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getRawOne: jest.fn().mockResolvedValue({ max: `TKT-${year}-0041` }) }),
      );
      expect(await service.generateTicketNumber()).toBe(`TKT-${year}-0042`);
    });
  });

  describe('computeSla', () => {
    it('URGENT → 1h response / 8h resolve', () => {
      const from = new Date('2026-01-01T00:00:00Z');
      const sla = service.computeSla(TicketPriority.URGENT, from);
      expect(sla.firstResponseDueAt.getTime() - from.getTime()).toBe(3600_000);
      expect(sla.resolveDueAt.getTime() - from.getTime()).toBe(8 * 3600_000);
    });

    it('LOW → 24h response / 168h resolve', () => {
      const from = new Date('2026-01-01T00:00:00Z');
      const sla = service.computeSla(TicketPriority.LOW, from);
      expect(sla.firstResponseDueAt.getTime() - from.getTime()).toBe(24 * 3600_000);
      expect(sla.resolveDueAt.getTime() - from.getTime()).toBe(168 * 3600_000);
    });
  });

  describe('create', () => {
    it('staff creates ticket for an owned client with SLA + number', async () => {
      clientRepo.findOne.mockResolvedValue({ id: 'c-1', ownerId: 'u-1', userId: 'cu-1' });
      // findOne (used by post-create findOne) returns a full ticket
      ticketRepo.findOne.mockResolvedValue({
        id: 't-1',
        ticketNumber: 'TKT-2026-0001',
        status: TicketStatus.OPEN,
        clientId: 'c-1',
        client: { id: 'c-1', ownerId: 'u-1' },
        replies: [],
      });

      const result = await service.create(
        { subject: 'Help', description: 'broken', clientId: 'c-1', priority: TicketPriority.HIGH } as any,
        makeUser(),
      );
      expect(ticketRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Help',
          clientId: 'c-1',
          source: TicketSource.WEB,
          priority: TicketPriority.HIGH,
          firstResponseDueAt: expect.any(Date),
        }),
      );
      expect(result.id).toBe('t-1');
    });

    it('EMPLOYEE cannot create for a client they do not own', async () => {
      clientRepo.findOne.mockResolvedValue({ id: 'c-1', ownerId: 'other' });
      await expect(
        service.create(
          { subject: 'x', description: 'y', clientId: 'c-1' } as any,
          makeUser({ role: UserRole.EMPLOYEE }),
        ),
      ).rejects.toBeDefined();
    });

    it('CLIENT ticket derives clientId from their profile', async () => {
      clientRepo.findOne
        .mockResolvedValueOnce({ id: 'c-9', ownerId: 'emp-1', userId: 'u-2' }) // requireClientForUser
        .mockResolvedValue({ id: 'c-9', ownerId: 'emp-1', userId: 'u-2' }); // notify lookups
      ticketRepo.findOne.mockResolvedValue({
        id: 't-9',
        clientId: 'c-9',
        client: { id: 'c-9', ownerId: 'emp-1' },
        replies: [],
        status: TicketStatus.OPEN,
      });
      const result = await service.create(
        { subject: 'x', description: 'y' } as any,
        makeUser({ id: 'u-2', role: UserRole.CLIENT }),
      );
      expect(ticketRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'c-9', assigneeId: null }),
      );
      expect(result.id).toBe('t-9');
    });
  });

  describe('addReply', () => {
    it('staff reply stamps firstRespondedAt and moves OPEN → IN_PROGRESS', async () => {
      const ticket = {
        id: 't-1',
        status: TicketStatus.OPEN,
        clientId: 'c-1',
        client: { id: 'c-1', ownerId: 'u-1' },
        firstRespondedAt: null,
      };
      ticketRepo.findOne
        .mockResolvedValueOnce(ticket) // initial load
        .mockResolvedValue({ ...ticket, status: TicketStatus.IN_PROGRESS, replies: [] }); // findOne after
      clientRepo.findOne.mockResolvedValue({ id: 'c-1', ownerId: 'u-1', userId: 'cu-1' });

      await service.addReply('t-1', { body: 'on it' } as any, makeUser());

      expect(replyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'on it', isInternal: false }),
      );
      const savedTicket = ticketRepo.save.mock.calls[0][0];
      expect(savedTicket.firstRespondedAt).toBeInstanceOf(Date);
      expect(savedTicket.status).toBe(TicketStatus.IN_PROGRESS);
    });

    it('client cannot mark a reply internal', async () => {
      const ticket = {
        id: 't-1',
        status: TicketStatus.OPEN,
        clientId: 'c-9',
        client: { id: 'c-9', ownerId: 'emp-1' },
      };
      ticketRepo.findOne
        .mockResolvedValueOnce(ticket)
        .mockResolvedValue({ ...ticket, replies: [] });
      clientRepo.findOne.mockResolvedValue({ id: 'c-9', ownerId: 'emp-1', userId: 'u-2' });

      await service.addReply(
        't-1',
        { body: 'hi', isInternal: true } as any,
        makeUser({ id: 'u-2', role: UserRole.CLIENT }),
      );
      expect(replyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isInternal: false }),
      );
    });

    it('rejects replying to a CLOSED ticket', async () => {
      ticketRepo.findOne.mockResolvedValue({
        id: 't-1',
        status: TicketStatus.CLOSED,
        clientId: 'c-1',
        client: { id: 'c-1', ownerId: 'u-1' },
      });
      await expect(
        service.addReply('t-1', { body: 'x' } as any, makeUser()),
      ).rejects.toBeDefined();
    });
  });

  describe('update', () => {
    it('CLIENT cannot update', async () => {
      await expect(
        service.update('t-1', { status: TicketStatus.RESOLVED } as any, makeUser({ role: UserRole.CLIENT })),
      ).rejects.toBeDefined();
    });

    it('setting RESOLVED stamps resolvedAt + notifies client', async () => {
      const ticket = {
        id: 't-1',
        status: TicketStatus.IN_PROGRESS,
        clientId: 'c-1',
        client: { id: 'c-1', ownerId: 'u-1' },
        resolvedAt: null,
        createdAt: new Date(),
      };
      ticketRepo.findOne
        .mockResolvedValueOnce(ticket)
        .mockResolvedValue({ ...ticket, status: TicketStatus.RESOLVED, replies: [] });
      clientRepo.findOne.mockResolvedValue({ id: 'c-1', ownerId: 'u-1', userId: 'cu-1' });

      await service.update('t-1', { status: TicketStatus.RESOLVED } as any, makeUser());
      const saved = ticketRepo.save.mock.calls[0][0];
      expect(saved.status).toBe(TicketStatus.RESOLVED);
      expect(saved.resolvedAt).toBeInstanceOf(Date);
      expect(notificationService.createErpNotification).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('blocks non-admin', async () => {
      await expect(
        service.remove('t-1', makeUser({ role: UserRole.EMPLOYEE })),
      ).rejects.toBeDefined();
    });
  });

  describe('API keys', () => {
    it('createApiKey returns plaintext once and stores only the hash', async () => {
      clientRepo.findOne.mockResolvedValue({ id: 'c-1', ownerId: 'u-1' });
      const { apiKey, plaintextKey } = await service.createApiKey('c-1', 'CI', makeUser());
      expect(plaintextKey).toMatch(/^hk_live_[0-9a-f]{48}$/);
      const expectedHash = createHash('sha256').update(plaintextKey).digest('hex');
      const savedArg = apiKeyRepo.save.mock.calls[0][0];
      expect(savedArg.keyHash).toBe(expectedHash);
      expect(savedArg.prefix).toBe(plaintextKey.slice(0, 12));
      expect(apiKey.label).toBe('CI');
    });

    it('revokeApiKey deactivates', async () => {
      apiKeyRepo.findOne.mockResolvedValue({
        id: 'k-1',
        isActive: true,
        client: { ownerId: 'u-1' },
      });
      const result = await service.revokeApiKey('k-1', makeUser());
      expect(result.isActive).toBe(false);
    });
  });

  describe('ingestTicket', () => {
    it('opens an API-sourced ticket scoped to the key client', async () => {
      clientRepo.findOne.mockResolvedValue({ id: 'c-1', ownerId: 'u-1', userId: 'cu-1' });
      const result = await service.ingestTicket(
        { id: 'k-1', clientId: 'c-1' } as any,
        { subject: 'API bug', description: 'boom', externalReporter: 'jane@ext' } as any,
      );
      const saved = ticketRepo.save.mock.calls[0][0];
      expect(saved.source).toBe(TicketSource.API);
      expect(saved.clientId).toBe('c-1');
      expect(saved.reporterId).toBeNull();
      expect(saved.description).toContain('jane@ext');
      expect(result.ticketNumber).toBeDefined();
      expect(result).not.toHaveProperty('reporterId');
    });
  });

  describe('ingestReply', () => {
    it('rejects replying to a ticket owned by another client', async () => {
      ticketRepo.findOne.mockResolvedValue({ id: 't-1', clientId: 'other', status: TicketStatus.OPEN });
      await expect(
        service.ingestReply({ id: 'k-1', clientId: 'c-1' } as any, 't-1', { body: 'x' } as any),
      ).rejects.toBeDefined();
    });
  });

  describe('getStats', () => {
    it('aggregates counts by status/priority', async () => {
      ticketRepo.createQueryBuilder.mockReturnValue(
        buildQb({
          getMany: jest.fn().mockResolvedValue([
            { status: TicketStatus.OPEN, priority: TicketPriority.HIGH },
            { status: TicketStatus.CLOSED, priority: TicketPriority.LOW },
          ]),
        }),
      );
      const stats = await service.getStats(makeUser());
      expect(stats.total).toBe(2);
      expect(stats.open).toBe(1);
      expect(stats.byStatus[TicketStatus.OPEN]).toBe(1);
      expect(stats.byPriority[TicketPriority.HIGH]).toBe(1);
    });
  });
});
