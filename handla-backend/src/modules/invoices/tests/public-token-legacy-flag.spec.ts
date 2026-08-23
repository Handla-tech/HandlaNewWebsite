/**
 * ══════════════════════════════════════════════════════════════════════════
 *  INFO-01 — Phase 21: legacy compatibility (PUBLIC_DOC_LEGACY_ID_LINKS)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Boots the real Invoice / Quotation / Contract controllers + services twice —
 * once with PUBLIC_DOC_LEGACY_ID_LINKS=true and once =false — and proves the
 * transitional compatibility contract:
 *
 *   legacyIdLinks = TRUE
 *     • invoice raw-id public route works
 *     • contract raw-id public route works
 *     • token routes work (all three types)
 *     • newly generated share links are STILL token URLs
 *
 *   legacyIdLinks = FALSE
 *     • invoice raw-id public route → 404 (behaves as if it does not exist)
 *     • contract raw-id public route → 404
 *     • token routes still work (all three types)
 *     • quotation token routes still work (quotations never had a raw-id route)
 *     • share-link generation remains token-only
 *
 * Also verifies legacy access does NOT bypass lifecycle (expiry / revocation /
 * rotation still apply to the token routes regardless of the flag).
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
const ADMIN = { id: 'admin-1', email: 'admin@h.tech', role: UserRole.ADMIN, isDisabled: false, isArchived: false };
const adminJwt = () => jwt.sign({ sub: ADMIN.id, email: ADMIN.email, role: ADMIN.role }, JWT_SECRET, { expiresIn: '15m' });

const INV_ID = '22222222-2222-4222-8222-222222222201';
const CON_ID = '44444444-4444-4444-8444-444444444401';
const QUO_ID = '33333333-3333-4333-8333-333333333301';
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

function makeStore<T extends { id: string; publicToken?: string | null }>(seed: T[] = []) {
  const rows = new Map<string, T>();
  for (const r of seed) rows.set(r.id, r);
  const matches = (row: any, where: any) => Object.entries(where).every(([k, v]) => row[k] === v);
  return {
    rows,
    findOne: jest.fn(async ({ where }: any) => {
      for (const row of rows.values()) if (matches(row, where)) return { ...row };
      return null;
    }),
    save: jest.fn(async (e: any) => { rows.set(e.id, { ...rows.get(e.id), ...e }); return { ...rows.get(e.id) }; }),
    find: jest.fn(async () => [...rows.values()]),
    create: jest.fn((d: any) => ({ ...d })),
    remove: jest.fn(async (e: any) => { rows.delete(e.id); }),
    delete: jest.fn(async () => ({})),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        leftJoinAndSelect: () => qb, andWhere: () => qb, orderBy: () => qb, skip: () => qb, take: () => qb,
        where: () => qb, select: () => qb, getManyAndCount: async () => [[...rows.values()], rows.size],
        getRawOne: async () => ({ max: null }), update: () => qb, set: () => qb, whereInIds: () => qb, execute: async () => ({}),
      };
      return qb;
    }),
  };
}

const clientRow: any = { id: CLIENT_ID, userId: 'cu-1', ownerId: 'emp-own', company: 'Acme', user: { name: 'Acme', email: 'a@h.tech' } };
const seedInvoice = () => ({
  id: INV_ID, invoiceNumber: 'INV-1', clientId: CLIENT_ID, ownerId: 'emp-own', subtotal: 100, taxRate: 0,
  taxAmount: 0, total: 100, currency: 'USD', paymentStatus: InvoicePaymentStatus.UNPAID, dueDate: null,
  paidAt: null, notes: null, createdAt: new Date('2026-01-01'), lineItems: [], client: clientRow, owner: { name: 'O' },
  publicToken: null, publicTokenExpiresAt: null, publicTokenRevokedAt: null, publicTokenCreatedAt: null,
});
const seedContract = () => ({
  id: CON_ID, title: 'C', body: 'Body long enough.', clientId: CLIENT_ID, ownerId: 'emp-own',
  status: ContractStatus.SENT, details: null, createdAt: new Date('2026-01-01'), sentAt: null, signedAt: null,
  client: clientRow, owner: { name: 'O' }, publicToken: null, publicTokenExpiresAt: null, publicTokenRevokedAt: null, publicTokenCreatedAt: null,
});
const seedQuotation = () => ({
  id: QUO_ID, quoteNumber: 'QUO-1', title: 'Q', clientId: CLIENT_ID, ownerId: 'emp-own', status: QuotationStatus.SENT,
  subtotal: 100, taxRate: 0, taxAmount: 0, total: 100, currency: 'USD', validUntil: null, notes: null,
  createdAt: new Date('2026-01-01'), lineItems: [], client: clientRow, owner: { name: 'O' }, acceptedAt: null, rejectedAt: null,
  publicToken: null, publicTokenExpiresAt: null, publicTokenRevokedAt: null, publicTokenCreatedAt: null,
});

async function bootApp(legacyIdLinks: boolean) {
  const invoiceStore = makeStore([seedInvoice()]);
  const quotationStore = makeStore([seedQuotation()]);
  const contractStore = makeStore([seedContract()]);
  const clientStore = makeStore([clientRow]);
  const noopEmail = { sendMail: jest.fn(), sendEmail: jest.fn(), sendInvoiceEmail: jest.fn(), sendQuotationEmail: jest.fn(), sendContractEmail: jest.fn() };
  const dataSourceMock = { transaction: jest.fn(async (cb: any) => cb({ create: (_: any, d: any) => ({ ...d }), save: async (_: any, d: any) => d, findOneOrFail: async () => seedQuotation(), delete: async () => ({}) })) };

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => ({ jwt: { secret: JWT_SECRET }, auth: { frontendUrl: 'https://handla.tech' }, publicDoc: { legacyIdLinks, defaultExpiryDays: 0 } })],
      }),
      PassportModule,
      ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 10000 }] }),
    ],
    controllers: [InvoicesController, QuotationsController, ContractsController],
    providers: [
      InvoicesService, QuotationsService, ContractsService, PublicTokenService, ConfigService, JwtStrategy, Reflector,
      { provide: getRepositoryToken(Invoice), useValue: invoiceStore },
      { provide: getRepositoryToken(InvoiceLineItem), useValue: makeStore() },
      { provide: getRepositoryToken(Quotation), useValue: quotationStore },
      { provide: getRepositoryToken(QuotationLineItem), useValue: makeStore() },
      { provide: getRepositoryToken(Contract), useValue: contractStore },
      { provide: getRepositoryToken(Client), useValue: clientStore },
      { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(async ({ where: { id } }: any) => (id === ADMIN.id ? ADMIN : null)), find: jest.fn(async () => []) } },
      { provide: getRepositoryToken(Conversation), useValue: makeStore() },
      { provide: NotificationService, useValue: { createErpNotification: jest.fn(), createNotification: jest.fn() } },
      { provide: EmailService, useValue: noopEmail },
      { provide: ChatService, useValue: { saveMessage: jest.fn() } },
      { provide: ExpensesService, useValue: { createFromPaidInvoice: jest.fn() } },
      { provide: AwsService, useValue: { uploadBuffer: jest.fn(), buildFileUrl: jest.fn(), generatePresignedUrl: jest.fn() } },
      { provide: DataSource, useValue: dataSourceMock },
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use((cookieParser as any)());
  app.useGlobalPipes(globalValidationPipe);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.init();
  return { app, invoiceStore, quotationStore, contractStore };
}

async function genToken(app: INestApplication, kind: string, id: string): Promise<string> {
  const res = await request(app.getHttpServer()).post(`/erp/${kind}/${id}/public-link`).set('Authorization', `Bearer ${adminJwt()}`).send({});
  return (res.body?.data ?? res.body)?.token;
}

describe('INFO-01 Phase 21 — PUBLIC_DOC_LEGACY_ID_LINKS=true (compatibility ON)', () => {
  let ctx: Awaited<ReturnType<typeof bootApp>>;
  beforeAll(async () => { ctx = await bootApp(true); });
  afterAll(async () => { await ctx.app.close(); });

  it('invoice raw-id public route WORKS', async () => {
    await request(ctx.app.getHttpServer()).get(`/erp/invoices/public/${INV_ID}`).expect(200);
  });
  it('contract raw-id public route WORKS', async () => {
    await request(ctx.app.getHttpServer()).get(`/erp/contracts/public/${CON_ID}`).expect(200);
  });
  it('token routes WORK for all three document types', async () => {
    const it1 = await genToken(ctx.app, 'invoices', INV_ID);
    const ct1 = await genToken(ctx.app, 'contracts', CON_ID);
    const qt1 = await genToken(ctx.app, 'quotations', QUO_ID);
    await request(ctx.app.getHttpServer()).get(`/erp/invoices/public/token/${it1}`).expect(200);
    await request(ctx.app.getHttpServer()).get(`/erp/contracts/public/token/${ct1}`).expect(200);
    await request(ctx.app.getHttpServer()).get(`/erp/quotations/public/token/${qt1}`).expect(200);
  });
  it('newly generated share links are STILL token URLs (never raw-id)', async () => {
    const res = await request(ctx.app.getHttpServer()).post(`/erp/invoices/${INV_ID}/public-link`).set('Authorization', `Bearer ${adminJwt()}`).send({});
    const body = res.body?.data ?? res.body;
    expect(body.publicUrl).toContain('/invoice/public/token/');
    expect(body.publicUrl).not.toMatch(new RegExp(`/public/${INV_ID}$`));
  });
});

describe('INFO-01 Phase 21 — PUBLIC_DOC_LEGACY_ID_LINKS=false (compatibility OFF)', () => {
  let ctx: Awaited<ReturnType<typeof bootApp>>;
  beforeAll(async () => { ctx = await bootApp(false); });
  afterAll(async () => { await ctx.app.close(); });

  it('invoice raw-id public route is DISABLED (404)', async () => {
    await request(ctx.app.getHttpServer()).get(`/erp/invoices/public/${INV_ID}`).expect(404);
  });
  it('contract raw-id public route is DISABLED (404)', async () => {
    await request(ctx.app.getHttpServer()).get(`/erp/contracts/public/${CON_ID}`).expect(404);
  });
  it('invoice + contract + quotation token routes STILL WORK', async () => {
    const it1 = await genToken(ctx.app, 'invoices', INV_ID);
    const ct1 = await genToken(ctx.app, 'contracts', CON_ID);
    const qt1 = await genToken(ctx.app, 'quotations', QUO_ID);
    await request(ctx.app.getHttpServer()).get(`/erp/invoices/public/token/${it1}`).expect(200);
    await request(ctx.app.getHttpServer()).get(`/erp/contracts/public/token/${ct1}`).expect(200);
    await request(ctx.app.getHttpServer()).get(`/erp/quotations/public/token/${qt1}`).expect(200);
  });
  it('share-link generation remains token-only', async () => {
    const res = await request(ctx.app.getHttpServer()).post(`/erp/contracts/${CON_ID}/public-link`).set('Authorization', `Bearer ${adminJwt()}`).send({});
    const body = res.body?.data ?? res.body;
    expect(body.publicUrl).toContain('/contract/public/token/');
  });
  it('token lifecycle still applies with legacy OFF: revoke → 410, rotate invalidates old', async () => {
    const t1 = await genToken(ctx.app, 'invoices', INV_ID);
    await request(ctx.app.getHttpServer()).get(`/erp/invoices/public/token/${t1}`).expect(200);
    // rotate → old dies (404), new works
    const rot = await request(ctx.app.getHttpServer()).post(`/erp/invoices/${INV_ID}/public-link/rotate`).set('Authorization', `Bearer ${adminJwt()}`).send({});
    const t2 = (rot.body?.data ?? rot.body)?.token;
    expect(t2).not.toBe(t1);
    await request(ctx.app.getHttpServer()).get(`/erp/invoices/public/token/${t1}`).expect(404);
    await request(ctx.app.getHttpServer()).get(`/erp/invoices/public/token/${t2}`).expect(200);
    // revoke → 410 Gone
    await request(ctx.app.getHttpServer()).delete(`/erp/invoices/${INV_ID}/public-link`).set('Authorization', `Bearer ${adminJwt()}`).expect(200);
    await request(ctx.app.getHttpServer()).get(`/erp/invoices/public/token/${t2}`).expect(410);
  });
});
