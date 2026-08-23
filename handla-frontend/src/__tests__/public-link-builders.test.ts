/**
 * INFO-01 Phase 20 — share-link / URL-builder regression.
 *
 * Locks in the capability-token URL contract so a regression to raw-id public
 * links cannot land silently:
 *   1. Every public API builder targets `/public/token/:token` (never a bare
 *      `/public/:id` for NEW links) and the management endpoints exist.
 *   2. The PDF QR builders emit the `/…/public/token/:token` route when a
 *      token is available, and only fall back to the legacy raw-id route when
 *      no token exists.
 *
 * The axios instance created inside api.ts is replaced with a spy so we can
 * assert the exact request path each builder produces.
 */

// ── Mock axios so api.ts's `axios.create()` returns our spy instance ─────────
const calls: Array<{ method: string; url: string }> = [];
const record = (method: string) => (url: string) => {
  calls.push({ method, url });
  return Promise.resolve({ data: { data: {} } });
};
const spyInstance: any = {
  get: jest.fn(record('get')),
  post: jest.fn(record('post')),
  patch: jest.fn(record('patch')),
  delete: jest.fn(record('delete')),
  interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
};
jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn(() => spyInstance) },
  create: jest.fn(() => spyInstance),
}));

// QRCode.toDataURL is called by the PDF builders — stub it and capture the target.
const qrTargets: string[] = [];
jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: jest.fn((t: string) => { qrTargets.push(t); return Promise.resolve('data:image/png;base64,x'); }) },
  toDataURL: jest.fn((t: string) => { qrTargets.push(t); return Promise.resolve('data:image/png;base64,x'); }),
}));

// jsPDF + autotable are heavy/DOM — stub to a no-op doc so builders run headless.
jest.mock('jspdf', () => {
  const doc: any = new Proxy(
    { internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } }, lastAutoTable: { finalY: 100 } },
    { get: (target, prop) => (prop in target ? (target as any)[prop] : jest.fn(() => doc)) },
  );
  return { __esModule: true, default: jest.fn(() => doc), jsPDF: jest.fn(() => doc) };
});
jest.mock('jspdf-autotable', () => ({ __esModule: true, default: jest.fn() }));

import { invoicesApi, contractsApi, quotationsApi } from '../lib/api';

const TOKEN = 'abcDEF123_-ghiJKL456mnoPQR789stuVWX012yz';
const UUID = '22222222-2222-4222-8222-222222222201';

beforeEach(() => { calls.length = 0; qrTargets.length = 0; });

describe('INFO-01 Phase 20 — API public-link builders use the token route', () => {
  it('invoice + contract public reads use /public/token/:token', () => {
    invoicesApi.getPublicInvoiceByToken(TOKEN);
    contractsApi.getPublicContractByToken(TOKEN);
    expect(calls).toEqual([
      { method: 'get', url: `/erp/invoices/public/token/${TOKEN}` },
      { method: 'get', url: `/erp/contracts/public/token/${TOKEN}` },
    ]);
  });

  it('quotation public read + accept + reject use /public/token/:token', () => {
    quotationsApi.getPublicQuotation(TOKEN);
    quotationsApi.publicAccept(TOKEN);
    quotationsApi.publicReject(TOKEN);
    expect(calls.map((c) => c.url)).toEqual([
      `/erp/quotations/public/token/${TOKEN}`,
      `/erp/quotations/public/token/${TOKEN}/accept`,
      `/erp/quotations/public/token/${TOKEN}/reject`,
    ]);
  });

  it('none of the canonical public read builders embed a raw entity id path', () => {
    invoicesApi.getPublicInvoiceByToken(TOKEN);
    contractsApi.getPublicContractByToken(TOKEN);
    quotationsApi.getPublicQuotation(TOKEN);
    for (const c of calls) {
      expect(c.url).toContain('/public/token/');
      expect(c.url).not.toMatch(/\/public\/[0-9a-f-]{36}$/i);
    }
  });

  it('management endpoints exist for all three document types', () => {
    invoicesApi.generatePublicLink(UUID);
    invoicesApi.rotatePublicLink(UUID);
    invoicesApi.setPublicLinkExpiry(UUID, { expiresInDays: 7 });
    invoicesApi.revokePublicLink(UUID);
    contractsApi.generatePublicLink(UUID);
    quotationsApi.generatePublicLink(UUID);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `post /erp/invoices/${UUID}/public-link`,
      `post /erp/invoices/${UUID}/public-link/rotate`,
      `patch /erp/invoices/${UUID}/public-link`,
      `delete /erp/invoices/${UUID}/public-link`,
      `post /erp/contracts/${UUID}/public-link`,
      `post /erp/quotations/${UUID}/public-link`,
    ]);
  });
});

describe('INFO-01 Phase 20 — PDF QR builders prefer the token route', () => {
  const invoice: any = {
    id: UUID, clientId: UUID, invoiceNumber: 'INV-1', subtotal: 100, taxRate: 0, taxAmount: 0,
    total: 100, currency: 'USD', paymentStatus: 'UNPAID', createdAt: '2026-01-01',
    lineItems: [], client: null, owner: null,
  };
  const contract: any = {
    id: UUID, clientId: UUID, title: 'C', body: 'Body', status: 'SENT', createdAt: '2026-01-01',
    sentAt: null, signedAt: null, client: null, owner: null,
  };

  // The QR target is resolved (and captured) at the very top of each builder,
  // BEFORE any jsPDF layout work. We only assert the captured target, so we
  // tolerate a later layout throw from the heavily-stubbed jsPDF doc.
  const runPdf = async (fn: () => Promise<unknown>) => {
    try { await fn(); } catch { /* layout stubs may throw after QR is built */ }
  };

  it('invoice QR targets the token route when a token is supplied', async () => {
    const { downloadInvoicePdf } = await import('../lib/pdf/invoice-pdf');
    await runPdf(() => downloadInvoicePdf(invoice, { baseUrl: 'https://handla.tech', publicToken: TOKEN }));
    expect(qrTargets[0]).toBe(`https://handla.tech/invoice/public/token/${TOKEN}`);
  });

  it('contract QR targets the token route when a token is supplied', async () => {
    const { downloadContractPdf } = await import('../lib/pdf/contract-pdf');
    await runPdf(() => downloadContractPdf(contract, { baseUrl: 'https://handla.tech', publicToken: TOKEN }));
    expect(qrTargets.find((t) => t.includes('/contract/public/token/'))).toBe(
      `https://handla.tech/contract/public/token/${TOKEN}`,
    );
  });

  it('invoice QR falls back to the legacy raw-id route only when NO token exists', async () => {
    const { downloadInvoicePdf } = await import('../lib/pdf/invoice-pdf');
    await runPdf(() => downloadInvoicePdf(invoice, { baseUrl: 'https://handla.tech' }));
    expect(qrTargets[0]).toBe(`https://handla.tech/invoice/public/${UUID}`);
  });
});
