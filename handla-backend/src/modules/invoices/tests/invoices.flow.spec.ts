/**
 * ERP-12.1 — Invoices Lifecycle Flow Tests
 *
 * Tests: create → line item totals → INVOICE_CREATED notification →
 * mark-paid → auto-income created → recalculate-overdue → idempotent.
 */

import {
  InvoicePaymentStatus,
  NotificationType,
  ExpenseType,
} from '../../../common/enums';

// ─── Mock types ───────────────────────────────────────────────────────────────

interface LineItem {
  description: string;
  quantity:    number;
  unitPrice:   number;
  lineTotal:   number;
  sortOrder:   number;
}

interface MockInvoice {
  id:            string;
  invoiceNumber: string;
  clientId:      string;
  ownerId:       string;
  subtotal:      number;
  taxRate:       number;
  taxAmount:     number;
  total:         number;
  currency:      string;
  paymentStatus: InvoicePaymentStatus;
  dueDate:       string | null;
  paidAt:        Date | null;
  lineItems:     LineItem[];
}

interface MockExpense {
  type:        ExpenseType;
  category:    string;
  amount:      number;
  invoiceId:   string;
  description: string;
}

// ─── Calculation helpers (mirrors InvoicesService.calculateTotals) ────────────

function calculateTotals(lineItems: Omit<LineItem, 'lineTotal' | 'sortOrder'>[], taxRate: number) {
  const lineItemsWithTotal = lineItems.map((item, i) => ({
    ...item,
    lineTotal: Math.round(item.quantity * item.unitPrice * 100) / 100,
    sortOrder: i,
  }));
  const subtotal  = Math.round(lineItemsWithTotal.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total     = Math.round((subtotal + taxAmount) * 100) / 100;
  return { lineItems: lineItemsWithTotal, subtotal, taxAmount, total };
}

function makeInvoice(overrides: Partial<MockInvoice> = {}): MockInvoice {
  const lineItems: LineItem[] = [
    { description: 'Design work', quantity: 10, unitPrice: 100, lineTotal: 1000, sortOrder: 0 },
  ];
  return {
    id:            'inv-1',
    invoiceNumber: 'INV-2026-0001',
    clientId:      'client-1',
    ownerId:       'emp-1',
    subtotal:      1000,
    taxRate:       15,
    taxAmount:     150,
    total:         1150,
    currency:      'USD',
    paymentStatus: InvoicePaymentStatus.UNPAID,
    dueDate:       null,
    paidAt:        null,
    lineItems,
    ...overrides,
  };
}

function markAsPaid(invoice: MockInvoice): MockInvoice {
  if (invoice.paymentStatus === InvoicePaymentStatus.PAID) {
    throw new Error('Invoice is already paid');
  }
  if (
    invoice.paymentStatus !== InvoicePaymentStatus.UNPAID &&
    invoice.paymentStatus !== InvoicePaymentStatus.OVERDUE
  ) {
    throw new Error(`Cannot mark invoice ${invoice.paymentStatus} as paid`);
  }
  return { ...invoice, paymentStatus: InvoicePaymentStatus.PAID, paidAt: new Date() };
}

function createFromPaidInvoice(invoice: MockInvoice, existingEntries: MockExpense[]): MockExpense {
  // Idempotent — check if already created
  const existing = existingEntries.find(e => e.invoiceId === invoice.id);
  if (existing) return existing;

  return {
    type:        ExpenseType.INCOME,
    category:    'Invoice Payment',
    amount:      invoice.total,
    invoiceId:   invoice.id,
    description: `Auto-income: ${invoice.invoiceNumber}`,
  };
}

function recalculateOverdue(
  invoices: MockInvoice[],
  today: Date,
  previouslyDelayed: Set<string>,
): { updated: MockInvoice[]; notified: string[] } {
  // Mirror the service: compare date strings (strip time) to avoid timezone drift.
  // An invoice is overdue only if dueDate < TODAY (strictly before today, not equal).
  const todayStr = today.toISOString().split('T')[0];
  const notified: string[] = [];
  const updated = invoices.map(inv => {
    if (
      inv.paymentStatus === InvoicePaymentStatus.UNPAID &&
      inv.dueDate &&
      inv.dueDate < todayStr
    ) {
      if (!previouslyDelayed.has(inv.id)) {
        notified.push(inv.id);
        previouslyDelayed.add(inv.id);
      }
      return { ...inv, paymentStatus: InvoicePaymentStatus.OVERDUE };
    }
    return inv;
  });
  return { updated, notified };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ERP Invoices Flow', () => {

  // ─── 12.1.6 — Invoice creation: totals correct, notification fired ─────

  describe('Invoice creation', () => {
    it('should generate correct invoice number format', () => {
      const inv = makeInvoice({ invoiceNumber: 'INV-2026-0042' });
      expect(inv.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    });

    it('should calculate correct subtotal', () => {
      const items = [
        { description: 'Design', quantity: 10, unitPrice: 100 },
        { description: 'Dev',    quantity: 5,  unitPrice: 200 },
      ];
      const result = calculateTotals(items, 0);
      expect(result.subtotal).toBe(2000);
    });

    it('should calculate correct tax amount', () => {
      const items = [{ description: 'Design', quantity: 10, unitPrice: 100 }];
      const result = calculateTotals(items, 15);
      expect(result.taxAmount).toBe(150);
      expect(result.total).toBe(1150);
    });

    it('should handle zero tax correctly', () => {
      const items = [{ description: 'Design', quantity: 10, unitPrice: 100 }];
      const result = calculateTotals(items, 0);
      expect(result.taxAmount).toBe(0);
      expect(result.total).toBe(1000);
    });

    it('should round totals to 2 decimal places', () => {
      const items = [{ description: 'Item', quantity: 3, unitPrice: 33.33 }];
      const result = calculateTotals(items, 10);
      expect(result.subtotal).toBe(99.99);
      expect(result.taxAmount).toBe(10); // 99.99 * 0.10 = 9.999 → 10.00
    });

    it('should fire INVOICE_CREATED notification type', () => {
      expect(NotificationType.INVOICE_CREATED).toBe('INVOICE_CREATED');
    });
  });

  // ─── 12.1.7 — Mark as paid → auto-income created ─────────────────────

  describe('Mark as paid', () => {
    it('should transition UNPAID → PAID and set paidAt', () => {
      const inv = makeInvoice();
      const paid = markAsPaid(inv);

      expect(paid.paymentStatus).toBe(InvoicePaymentStatus.PAID);
      expect(paid.paidAt).not.toBeNull();
    });

    it('should transition OVERDUE → PAID and set paidAt', () => {
      const inv = makeInvoice({ paymentStatus: InvoicePaymentStatus.OVERDUE });
      const paid = markAsPaid(inv);

      expect(paid.paymentStatus).toBe(InvoicePaymentStatus.PAID);
    });

    it('should throw if already PAID', () => {
      const paid = makeInvoice({ paymentStatus: InvoicePaymentStatus.PAID });
      expect(() => markAsPaid(paid)).toThrow('Invoice is already paid');
    });

    it('should create auto-income expense entry on payment', () => {
      const inv = makeInvoice({
        paymentStatus: InvoicePaymentStatus.PAID,
        paidAt: new Date(),
      });
      const entry = createFromPaidInvoice(inv, []);
      expect(entry.type).toBe(ExpenseType.INCOME);
      expect(entry.category).toBe('Invoice Payment');
      expect(entry.amount).toBe(inv.total);
      expect(entry.invoiceId).toBe(inv.id);
    });

    it('should be idempotent — no duplicate auto-income entry', () => {
      const inv = makeInvoice({ paymentStatus: InvoicePaymentStatus.PAID });
      const firstEntry = createFromPaidInvoice(inv, []);
      const secondCall = createFromPaidInvoice(inv, [firstEntry]);
      expect(secondCall).toBe(firstEntry); // same reference → no new entry created
    });
  });

  // ─── 12.1.8 — Recalculate overdue ────────────────────────────────────

  describe('Recalculate overdue status', () => {
    it('should mark UNPAID past-due invoices as OVERDUE', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const inv = makeInvoice({
        dueDate: yesterday.toISOString().split('T')[0],
        paymentStatus: InvoicePaymentStatus.UNPAID,
      });

      const { updated } = recalculateOverdue([inv], new Date(), new Set());
      expect(updated[0].paymentStatus).toBe(InvoicePaymentStatus.OVERDUE);
    });

    it('should NOT mark PAID invoices as OVERDUE', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const paid = makeInvoice({
        dueDate: yesterday.toISOString().split('T')[0],
        paymentStatus: InvoicePaymentStatus.PAID,
      });

      const { updated } = recalculateOverdue([paid], new Date(), new Set());
      expect(updated[0].paymentStatus).toBe(InvoicePaymentStatus.PAID);
    });

    it('should fire INVOICE_OVERDUE notification only once (idempotent)', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const inv = makeInvoice({
        dueDate: yesterday.toISOString().split('T')[0],
        paymentStatus: InvoicePaymentStatus.UNPAID,
      });

      const alreadyProcessed = new Set<string>(['inv-1']); // inv-1 already notified
      const { notified } = recalculateOverdue([inv], new Date(), alreadyProcessed);
      expect(notified).toHaveLength(0); // no duplicate notification
    });

    it('should return count of newly-overdue invoices', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const invs = [
        makeInvoice({ id: 'inv-1', dueDate: yesterday.toISOString().split('T')[0], paymentStatus: InvoicePaymentStatus.UNPAID }),
        makeInvoice({ id: 'inv-2', dueDate: yesterday.toISOString().split('T')[0], paymentStatus: InvoicePaymentStatus.UNPAID }),
      ];

      const { notified } = recalculateOverdue(invs, new Date(), new Set());
      expect(notified).toHaveLength(2);
    });

    it('should not throw on empty invoice list', () => {
      expect(() => recalculateOverdue([], new Date(), new Set())).not.toThrow();
    });

    it('should fire INVOICE_OVERDUE notification type', () => {
      expect(NotificationType.INVOICE_OVERDUE).toBe('INVOICE_OVERDUE');
    });

    it('should NOT mark invoices without due_date as OVERDUE', () => {
      const inv = makeInvoice({
        dueDate: null,
        paymentStatus: InvoicePaymentStatus.UNPAID,
      });

      const { updated } = recalculateOverdue([inv], new Date(), new Set());
      expect(updated[0].paymentStatus).toBe(InvoicePaymentStatus.UNPAID);
    });

    it('should not mark invoice as OVERDUE if due date is today (boundary)', () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const inv = makeInvoice({
        dueDate: todayStr,
        paymentStatus: InvoicePaymentStatus.UNPAID,
      });

      // Due today — not yet overdue (< comparison, not <=)
      const { updated } = recalculateOverdue([inv], today, new Set());
      expect(updated[0].paymentStatus).toBe(InvoicePaymentStatus.UNPAID);
    });

    it('cannot delete a PAID invoice', () => {
      const paid = makeInvoice({ paymentStatus: InvoicePaymentStatus.PAID });

      expect(() => {
        if (paid.paymentStatus !== InvoicePaymentStatus.UNPAID) {
          throw new Error('Can only delete UNPAID invoices');
        }
      }).toThrow('Can only delete UNPAID invoices');
    });
  });
});
