/**
 * ══════════════════════════════════════════════════════════════════════════
 *  INFO-01 — Public capability-link integration suite (real app + supertest)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Boots a REAL Nest HTTP app mounting the production Invoice / Quotation /
 * Contract controllers + their REAL services (repositories mocked with a small
 * in-memory store), wired with the production guard stack (JwtAuthGuard →
 * RolesGuard), the global ValidationPipe, the AllExceptionsFilter, the
 * TransformInterceptor (Cache-Control: no-store), and the real ThrottlerGuard.
 *
 * Covers:
 *   Phase 13 — token public GETs inherit Cache-Control: no-store / private
 *   Phase 14 — full token lifecycle (generate A → rotate B, A fails, B works →
 *              revoke B fails → generate C works → future expiry works before /
 *              fails after) using FAKE TIMERS (no sleeps)
 *   Phase 15 — cross-document token isolation (type-scoped lookup)
 *   Phase 16 — management authorization matrix + BOLA
 *   Phase 17 — quotation public accept/reject lifecycle regression
 *   Phase 18 — rate-limit metadata presence on public routes
 */
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as jwt from 'jsonwebtoken';
import * as supertest from 'supertest';
import * as cookieParser from 'cookie-parser';
const request = (supertest as any).default ?? supertest;

import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { globalValidationPipe } from '../../../common/pipes/validation.pipe';
import { AllExceptionsFilter } from '../../../common/filters/http-exception.filter';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';
import { UserRole, QuotationStatus, InvoicePaymentStatus, ContractStatus } from '../../../common/enums';

import { InvoicesController } from '../invoices.controller';
import { InvoicesService } from '../invoices.service';
import { QuotationsController } from '../../quotations/quotations.controller';
import { QuotationsService } from '../../quotations/quotations.service';
import { ContractsController } from '../../contracts/contracts.controller';
import { ContractsService } from '../../contracts/contracts.service';

import { Invoice } from '../entities/invoice.entity';
import { InvoiceLineItem } from '../entities/invoice-line-item.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationLineItem } from '../../quotations/entities/quotation-line-item.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../auth/entities/user.entity';
import { Conversation } from '../../chat/entities/conversation.entity';
import { NotificationService } from '../../notifications/notification.service';
import { EmailService } from '../../email/email.service';
import { ChatService } from '../../chat/chat.service';
import { ExpensesService } from '../../expenses/expenses.service';
import { AwsService } from '../../aws/aws.service';
import { PublicTokenService } from '../../../common/public-token/public-token.service';

const JWT_SECRET = 'unit-test-secret-that-is-at-least-32-chars-long!!';

// ── Actors ──────────────────────────────────────────────────────────────────
const users: Record<string, any> = {
  'admin-1':  { id: 'admin-1',  email: 'admin@h.tech',  role: UserRole.ADMIN,    isDisabled: false, isArchived: false },
  'emp-own':  { id: 'emp-own',  email: 'owner@h.tech',  role: UserRole.EMPLOYEE, isDisabled: false, isArchived: false },
  'emp-other':{ id: 'emp-other',email: 'other@h.tech',  role: UserRole.EMPLOYEE, isDisabled: false, isArchived: false },
  'client-1': { id: 'client-1', email: 'client@h.tech', role: UserRole.CLIENT,   isDisabled: false, isArchived: false },
  'lead-1':   { id: 'lead-1',   email: 'lead@h.tech',   role: UserRole.LEAD,     isDisabled: false, isArchived: false },
};
const tokenFor = (sub: string) =>
  jwt.sign(
    { sub, email: users[sub]?.email ?? 'x@h.tech', role: users[sub]?.role ?? 'CLIENT' },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

// ── Stable UUIDs ──────────────────────────────────────────────────────────
// The management routes validate `:id` with ParseUUIDPipe, so every document
// id used in a management URL must be a real v4 UUID. We keep readable names
// mapped to fixed UUIDs so assertions stay legible.
const UUID: Record<string, string> = {
  'client-1':  '11111111-1111-4111-8111-111111111111',
  'inv-1':     '22222222-2222-4222-8222-222222222201',
  'inv-lc':    '22222222-2222-4222-8222-2222222222c0',
  'quo-1':     '33333333-3333-4333-8333-333333333301',
  'quo-acc':   '33333333-3333-4333-8333-3333333333a1',
  'quo-rej':   '33333333-3333-4333-8333-333333333312',
  'quo-neg':   '33333333-3333-4333-8333-333333333313',
  'quo-A':     '33333333-3333-4333-8333-3333333333a2',
  'quo-B':     '33333333-3333-4333-8333-3333333333b2',
  'con-1':     '44444444-4444-4444-8444-444444444401',
  'con-other': '44444444-4444-4444-8444-444444444402',
};
const uid = (name: string) => UUID[name] ?? name;

// ── In-memory repositories ────────────────────────────────────────────────
// A tiny store keyed by id; findOne supports { where: { id } } and
// { where: { publicToken } } — exactly what the services use.
function makeStore<T extends { id: string; publicToken?: string | null }>(seed: T[] = []) {
  const rows = new Map<string, T>();
  for (const r of seed) rows.set(r.id, r);
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([k, v]) => row[k] === v);
  return {
    rows,
    findOne: jest.fn(async ({ where }: any) => {
      for (const row of rows.values()) if (matches(row, where)) return { ...row };
      return null;
    }),
    save: jest.fn(async (entity: any) => {
      rows.set(entity.id, { ...rows.get(entity.id), ...entity });
      return { ...rows.get(entity.id) };
    }),
    find: jest.fn(async () => [...rows.values()]),
    create: jest.fn((data: any) => ({ ...data })),
    remove: jest.fn(async (e: any) => { rows.delete(e.id); }),
    delete: jest.fn(async () => ({})),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        leftJoinAndSelect: () => qb, andWhere: () => qb, orderBy: () => qb,
        skip: () => qb, take: () => qb, where: () => qb, select: () => qb,
        getManyAndCount: async () => [[...rows.values()], rows.size],
        getRawOne: async () => ({ max: null }),
        update: () => qb, set: () => qb, whereInIds: () => qb, execute: async () => ({}),
      };
      return qb;
    }),
  };
}

describe('INFO-01 — public capability-link integration (real app)', () => {
  let app: INestApplication;
  let invoiceStore: ReturnType<typeof makeStore>;
  let quotationStore: ReturnType<typeof makeStore>;
  let contractStore: ReturnType<typeof makeStore>;
  let clientStore: ReturnType<typeof makeStore>;

  // Seed a client owned by emp-own's client record.
  const clientRow: any = {
    id: uid('client-1'), userId: 'client-user-1', ownerId: 'emp-own', company: 'Acme',
    user: { name: 'Acme Owner', email: 'acme@h.tech' },
  };

  function seedInvoice(over: Partial<any> = {}) {
    return {
      id: uid('inv-1'), invoiceNumber: 'INV-2026-0001', clientId: uid('client-1'), ownerId: 'emp-own',
      subtotal: 100, taxRate: 0, taxAmount: 0, total: 100, currency: 'USD',
      paymentStatus: InvoicePaymentStatus.UNPAID, dueDate: null, paidAt: null,
      notes: null, createdAt: new Date('2026-01-01'), lineItems: [],
      client: clientRow, owner: { name: 'Owner' },
      publicToken: null, publicTokenExpiresAt: null, publicTokenRevokedAt: null, publicTokenCreatedAt: null,
      ...over,
    };
  }
  function seedQuotation(over: Partial<any> = {}) {
    return {
      id: uid('quo-1'), quoteNumber: 'QUO-2026-0001', title: 'Q', clientId: uid('client-1'), ownerId: 'emp-own',
      status: QuotationStatus.SENT, subtotal: 100, taxRate: 0, taxAmount: 0, total: 100, currency: 'USD',
      validUntil: null, notes: null, createdAt: new Date('2026-01-01'), lineItems: [],
      client: clientRow, owner: { name: 'Owner' }, acceptedAt: null, rejectedAt: null,
      publicToken: null, publicTokenExpiresAt: null, publicTokenRevokedAt: null, publicTokenCreatedAt: null,
      ...over,
    };
  }
  function seedContract(over: Partial<any> = {}) {
    return {
      id: uid('con-1'), title: 'C', body: 'Body of the contract that is long enough.', clientId: uid('client-1'),
      ownerId: 'emp-own', status: ContractStatus.SENT, details: null,
      createdAt: new Date('2026-01-01'), sentAt: null, signedAt: null,
      client: clientRow, owner: { name: 'Owner' },
      publicToken: null, publicTokenExpiresAt: null, publicTokenRevokedAt: null, publicTokenCreatedAt: null,
      ...over,
    };
  }

  beforeAll(async () => {
    invoiceStore = makeStore([seedInvoice()]);
    quotationStore = makeStore([seedQuotation()]);
    contractStore = makeStore([seedContract()]);
    clientStore = makeStore([clientRow]);

    const noopNotify = { createErpNotification: jest.fn(), createNotification: jest.fn() };
    // NOTE: must NOT be a catch-all Proxy — a Proxy that returns a function for
    // every key (incl. `then`) is thenable and makes `await app.init()` hang.
    const noopEmail = {
      sendMail: jest.fn(), sendEmail: jest.fn(),
      sendInvoiceEmail: jest.fn(), sendQuotationEmail: jest.fn(),
      sendContractEmail: jest.fn(), sendNotificationEmail: jest.fn(),
    };
    const noopChat = { saveMessage: jest.fn() };
    const noopExpenses = { createFromPaidInvoice: jest.fn() };
    const noopAws = { uploadBuffer: jest.fn(), buildFileUrl: jest.fn(), generatePresignedUrl: jest.fn() };
    const dataSourceMock = {
      transaction: jest.fn(async (cb: any) => cb({
        create: (_E: any, d: any) => ({ ...d }),
        save: async (_E: any, d: any) => d,
        findOneOrFail: async () => seedQuotation(),
        delete: async () => ({}),
      })),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            jwt: { secret: JWT_SECRET },
            auth: { frontendUrl: 'https://handla.tech' },
            publicDoc: { legacyIdLinks: true, defaultExpiryDays: 0 },
          })],
        }),
        PassportModule,
        // Real throttler; high global limit so only per-route @Throttle matters.
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 10000 }] }),
      ],
      controllers: [InvoicesController, QuotationsController, ContractsController],
      providers: [
        InvoicesService, QuotationsService, ContractsService, PublicTokenService,
        ConfigService, JwtStrategy, Reflector,
        { provide: getRepositoryToken(Invoice), useValue: invoiceStore },
        { provide: getRepositoryToken(InvoiceLineItem), useValue: makeStore() },
        { provide: getRepositoryToken(Quotation), useValue: quotationStore },
        { provide: getRepositoryToken(QuotationLineItem), useValue: makeStore() },
        { provide: getRepositoryToken(Contract), useValue: contractStore },
        { provide: getRepositoryToken(Client), useValue: clientStore },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(async ({ where: { id } }: any) => users[id] ?? null), find: jest.fn(async () => []) } },
        { provide: getRepositoryToken(Conversation), useValue: makeStore() },
        { provide: NotificationService, useValue: noopNotify },
        { provide: EmailService, useValue: noopEmail },
        { provide: ChatService, useValue: noopChat },
        { provide: ExpensesService, useValue: noopExpenses },
        { provide: AwsService, useValue: noopAws },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((cookieParser as any)());
    app.useGlobalPipes(globalValidationPipe);
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => { await app?.close(); });

  const server = () => app.getHttpServer();
  const asAdmin = () => tokenFor('admin-1');
  const asOwner = () => tokenFor('emp-own');

  // Helper: generate a link for a doc and return its token from the store.
  async function generate(kind: 'invoices' | 'quotations' | 'contracts', id: string, body: any = {}) {
    const res = await request(server())
      .post(`/erp/${kind}/${uid(id)}/public-link`)
      .set('Authorization', `Bearer ${asAdmin()}`)
      .send(body);
    return res;
  }
  const storeFor = (k: string) =>
    k === 'invoices' ? invoiceStore : k === 'quotations' ? quotationStore : contractStore;
  const idFor = (k: string) => (k === 'invoices' ? uid('inv-1') : k === 'quotations' ? uid('quo-1') : uid('con-1'));

  // ────────────────────────────────────────────────────────────────────────
  // Phase 13 — cache headers on token public GET
  // ────────────────────────────────────────────────────────────────────────
  describe('Phase 13 — Cache-Control: no-store on token public GETs', () => {
    it.each(['invoices', 'quotations', 'contracts'] as const)(
      '%s token GET is private / no-store (no shared caching)',
      async (kind) => {
        const gen = await generate(kind, idFor(kind));
        expect(gen.status).toBe(201);
        const token = storeFor(kind).rows.get(idFor(kind))!.publicToken as string;
        const res = await request(server()).get(`/erp/${kind}/public/token/${token}`);
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toMatch(/no-store/);
        expect(res.headers['cache-control']).toMatch(/private/);
        expect(res.headers['cache-control']).not.toMatch(/public/);
      },
    );
  });

  // ────────────────────────────────────────────────────────────────────────
  // Phase 16 — management authorization matrix + BOLA
  // ────────────────────────────────────────────────────────────────────────
  describe('Phase 16 — management authorization matrix / BOLA', () => {
    const ops = [
      { name: 'generate', method: 'post', suffix: '/public-link' },
      { name: 'rotate', method: 'post', suffix: '/public-link/rotate' },
      { name: 'set-expiry', method: 'patch', suffix: '/public-link' },
      { name: 'revoke', method: 'delete', suffix: '/public-link' },
    ] as const;

    it.each(ops)('ADMIN can $name an invoice link', async (op) => {
      const res = await (request(server()) as any)[op.method](`/erp/invoices/${uid('inv-1')}${op.suffix}`)
        .set('Authorization', `Bearer ${asAdmin()}`).send({});
      expect([200, 201]).toContain(res.status);
    });

    it.each(ops)('owning EMPLOYEE can $name an invoice link', async (op) => {
      const res = await (request(server()) as any)[op.method](`/erp/invoices/${uid('inv-1')}${op.suffix}`)
        .set('Authorization', `Bearer ${asOwner()}`).send({});
      expect([200, 201]).toContain(res.status);
    });

    it.each(ops)('unauthorized EMPLOYEE (not owner) is DENIED 403 on $name (BOLA)', async (op) => {
      const res = await (request(server()) as any)[op.method](`/erp/invoices/${uid('inv-1')}${op.suffix}`)
        .set('Authorization', `Bearer ${tokenFor('emp-other')}`).send({});
      expect(res.status).toBe(403);
    });

    it.each(ops)('CLIENT is DENIED 403 on $name', async (op) => {
      const res = await (request(server()) as any)[op.method](`/erp/invoices/${uid('inv-1')}${op.suffix}`)
        .set('Authorization', `Bearer ${tokenFor('client-1')}`).send({});
      expect(res.status).toBe(403);
    });

    it.each(ops)('LEAD is DENIED 403 on $name', async (op) => {
      const res = await (request(server()) as any)[op.method](`/erp/invoices/${uid('inv-1')}${op.suffix}`)
        .set('Authorization', `Bearer ${tokenFor('lead-1')}`).send({});
      expect(res.status).toBe(403);
    });

    it.each(ops)('anonymous is DENIED 401 on $name', async (op) => {
      const res = await (request(server()) as any)[op.method](`/erp/invoices/${uid('inv-1')}${op.suffix}`).send({});
      expect(res.status).toBe(401);
    });

    it('client-supplied publicToken is rejected by the global ValidationPipe (400)', async () => {
      const res = await request(server())
        .post(`/erp/invoices/${uid('inv-1')}/public-link`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ publicToken: 'attacker-chosen-token' });
      expect(res.status).toBe(400);
    });

    it('EMPLOYEE cannot manage a contract owned by another employee (BOLA via id)', async () => {
      contractStore.rows.set(uid('con-other'), seedContract({ id: uid('con-other'), ownerId: 'emp-other' }));
      const res = await request(server())
        .post(`/erp/contracts/${uid('con-other')}/public-link`)
        .set('Authorization', `Bearer ${asOwner()}`).send({});
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Phase 15 — cross-document token isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('Phase 15 — cross-document token isolation (type-scoped lookup)', () => {
    it('an invoice token is not accepted by quotation/contract endpoints', async () => {
      await generate('invoices', 'inv-1');
      const invToken = invoiceStore.rows.get(uid('inv-1'))!.publicToken as string;
      await request(server()).get(`/erp/invoices/public/token/${invToken}`).expect(200);
      await request(server()).get(`/erp/quotations/public/token/${invToken}`).expect(404);
      await request(server()).get(`/erp/contracts/public/token/${invToken}`).expect(404);
    });

    it('a quotation token is not accepted by invoice/contract endpoints', async () => {
      await generate('quotations', 'quo-1');
      const quoToken = quotationStore.rows.get(uid('quo-1'))!.publicToken as string;
      await request(server()).get(`/erp/quotations/public/token/${quoToken}`).expect(200);
      await request(server()).get(`/erp/invoices/public/token/${quoToken}`).expect(404);
      await request(server()).get(`/erp/contracts/public/token/${quoToken}`).expect(404);
    });

    it('a contract token is not accepted by invoice/quotation endpoints', async () => {
      await generate('contracts', 'con-1');
      const conToken = contractStore.rows.get(uid('con-1'))!.publicToken as string;
      await request(server()).get(`/erp/contracts/public/token/${conToken}`).expect(200);
      await request(server()).get(`/erp/invoices/public/token/${conToken}`).expect(404);
      await request(server()).get(`/erp/quotations/public/token/${conToken}`).expect(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Phase 14 — full token lifecycle (fake timers, no sleeps)
  // ────────────────────────────────────────────────────────────────────────
  describe('Phase 14 — token lifecycle (invoice)', () => {
    it('generate A → rotate B (A fails, B works) → revoke B (fails) → generate C → future expiry', async () => {
      invoiceStore.rows.set(uid('inv-lc'), seedInvoice({ id: uid('inv-lc'), invoiceNumber: 'INV-LC' }));
      const url = (t: string) => `/erp/invoices/public/token/${t}`;

      // Generate A
      await generate('invoices', 'inv-lc');
      const tokenA = invoiceStore.rows.get(uid('inv-lc'))!.publicToken as string;
      await request(server()).get(url(tokenA)).expect(200);

      // Rotate → B
      await request(server()).post(`/erp/invoices/${uid('inv-lc')}/public-link/rotate`)
        .set('Authorization', `Bearer ${asAdmin()}`).send({}).expect(201);
      const tokenB = invoiceStore.rows.get(uid('inv-lc'))!.publicToken as string;
      expect(tokenB).not.toBe(tokenA);
      // A fails immediately (404 — no existence oracle), B works
      await request(server()).get(url(tokenA)).expect(404);
      await request(server()).get(url(tokenB)).expect(200);

      // Revoke B → 410 Gone
      await request(server()).delete(`/erp/invoices/${uid('inv-lc')}/public-link`)
        .set('Authorization', `Bearer ${asAdmin()}`).expect(200);
      await request(server()).get(url(tokenB)).expect(410);

      // Generate again → C (fresh, clears revoked)
      await generate('invoices', 'inv-lc');
      const tokenC = invoiceStore.rows.get(uid('inv-lc'))!.publicToken as string;
      await request(server()).get(url(tokenC)).expect(200);

      // Set a future expiry (+7 days) using fake timers to cross the boundary.
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-01T00:00:00Z'));
      await request(server()).patch(`/erp/invoices/${uid('inv-lc')}/public-link`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ expiresInDays: 7 }).expect(200);
      // Before expiry → works
      await request(server()).get(url(tokenC)).expect(200);
      // Advance 8 days → expired → 410 Gone
      jest.setSystemTime(new Date('2026-06-09T00:00:00Z'));
      await request(server()).get(url(tokenC)).expect(410);
      jest.useRealTimers();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Phase 17 — quotation public action regression
  // ────────────────────────────────────────────────────────────────────────
  describe('Phase 17 — quotation public accept/reject lifecycle', () => {
    const acceptUrl = (t: string) => `/erp/quotations/public/token/${t}/accept`;
    const rejectUrl = (t: string) => `/erp/quotations/public/token/${t}/reject`;

    it('valid current token + SENT → accept works; repeat is denied by the state machine', async () => {
      quotationStore.rows.set(uid('quo-acc'), seedQuotation({ id: uid('quo-acc'), status: QuotationStatus.SENT }));
      await generate('quotations', 'quo-acc');
      const t = quotationStore.rows.get(uid('quo-acc'))!.publicToken as string;
      await request(server()).post(acceptUrl(t)).expect(200);
      // Replay: now ACCEPTED, state machine rejects (422)
      await request(server()).post(acceptUrl(t)).expect(422);
    });

    it('valid current token + SENT → reject works', async () => {
      quotationStore.rows.set(uid('quo-rej'), seedQuotation({ id: uid('quo-rej'), status: QuotationStatus.SENT }));
      await generate('quotations', 'quo-rej');
      const t = quotationStore.rows.get(uid('quo-rej'))!.publicToken as string;
      await request(server()).post(rejectUrl(t)).send({ reason: 'no' }).expect(200);
    });

    it('invalid / revoked / expired / rotated-old tokens are denied before the state change', async () => {
      quotationStore.rows.set(uid('quo-neg'), seedQuotation({ id: uid('quo-neg'), status: QuotationStatus.SENT }));
      await generate('quotations', 'quo-neg');
      const tOld = quotationStore.rows.get(uid('quo-neg'))!.publicToken as string;

      // invalid
      await request(server()).post(acceptUrl('this-is-not-a-real-token')).expect(404);

      // rotated → old fails, quotation still SENT (no state change from the probe)
      await request(server()).post(`/erp/quotations/${uid('quo-neg')}/public-link/rotate`)
        .set('Authorization', `Bearer ${asAdmin()}`).send({}).expect(201);
      await request(server()).post(acceptUrl(tOld)).expect(404);
      expect(quotationStore.rows.get(uid('quo-neg'))!.status).toBe(QuotationStatus.SENT);

      // revoke → new token fails 410, still SENT
      const tNew = quotationStore.rows.get(uid('quo-neg'))!.publicToken as string;
      await request(server()).delete(`/erp/quotations/${uid('quo-neg')}/public-link`)
        .set('Authorization', `Bearer ${asAdmin()}`).expect(200);
      await request(server()).post(acceptUrl(tNew)).expect(410);
      expect(quotationStore.rows.get(uid('quo-neg'))!.status).toBe(QuotationStatus.SENT);
    });

    it('quotation A token cannot act on quotation B', async () => {
      quotationStore.rows.set(uid('quo-A'), seedQuotation({ id: uid('quo-A'), status: QuotationStatus.SENT }));
      quotationStore.rows.set(uid('quo-B'), seedQuotation({ id: uid('quo-B'), status: QuotationStatus.SENT }));
      await generate('quotations', 'quo-A');
      const tokenA = quotationStore.rows.get(uid('quo-A'))!.publicToken as string;
      // Using A's token only ever resolves quotation A (type + token scoped),
      // so B is untouched. Accept A, then B is still SENT.
      await request(server()).post(acceptUrl(tokenA)).expect(200);
      expect(quotationStore.rows.get(uid('quo-B'))!.status).toBe(QuotationStatus.SENT);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Phase 18 — rate-limit metadata presence
  // ────────────────────────────────────────────────────────────────────────
  describe('Phase 18 — throttling configured on public token routes', () => {
    const reflector = new Reflector();
    const throttleMeta = (target: any, method: string) => {
      // @nestjs/throttler stores per-route config under this metadata key.
      const proto = target.prototype;
      const keys = Reflect.getMetadataKeys(proto[method]) || [];
      // @nestjs/throttler v6 stores per-route config under keys prefixed
      // `THROTTLER:` (e.g. THROTTLER:LIMITdefault). Match case-insensitively.
      return keys.some((k: any) => /throttler/i.test(String(k)));
    };

    it('invoice + contract public token GET carry @Throttle metadata', () => {
      expect(throttleMeta(InvoicesController, 'findOnePublicByToken')).toBe(true);
      expect(throttleMeta(ContractsController, 'findOnePublicByToken')).toBe(true);
    });

    it('quotation token GET + accept + reject carry @Throttle metadata', () => {
      expect(throttleMeta(QuotationsController, 'findByPublicTokenV2')).toBe(true);
      expect(throttleMeta(QuotationsController, 'acceptByTokenV2')).toBe(true);
      expect(throttleMeta(QuotationsController, 'rejectByTokenV2')).toBe(true);
    });
  });
});
