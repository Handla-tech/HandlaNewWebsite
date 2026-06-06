/**
 * Invoice PDF Generator — Handla
 *
 * Pure black-and-white, print-friendly A4 layout optimised for B&W copiers:
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │  Handla details      [QR code]       INVOICE meta             │
 *   │   logo + contact     scan → opens    number / dates / status  │
 *   │                      public viewer                            │
 *   │ ═════════════════════════════════════════════════════════════  │
 *   │  Order details table (description / qty / unit / total)        │
 *   │  Subtotal / tax / TOTAL                                        │
 *   │ ─────────────────────────────────────────────────────────────  │
 *   │  FROM + signature                     BILLED TO                │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Design rules for B&W printing:
 *   - No filled backgrounds, no colour accents, no light-grey shading.
 *   - All text rendered in 100 % black.
 *   - Dividers / borders are 100 % black thin strokes.
 *   - Status pill is an outlined rectangle (no fill) so it photocopies.
 *   - QR code is true black-on-white.
 *
 * Libraries used (all client-side, no backend rendering):
 *   - jspdf            → core PDF engine
 *   - jspdf-autotable  → order-details table
 *   - qrcode           → encodes the public viewer URL as a PNG data URL
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import type { Invoice } from '@/types';

// ─── Colour tokens — single black tone, used everywhere ──────────────────────

const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];

// ─── Layout constants (mm — jsPDF default unit) ──────────────────────────────

const PAGE = {
  width:   210, // A4 portrait
  height:  297,
  margin:  16,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setFill(doc: jsPDF, c: [number, number, number]) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function setText(doc: jsPDF, c: [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2]);
}
function setDraw(doc: jsPDF, c: [number, number, number]) {
  doc.setDrawColor(c[0], c[1], c[2]);
}

function formatCurrency(n: number, ccy: string): string {
  // Keep "$" prefix for USD, else just print the number. The currency code
  // is shown next to the grand total so the prefix doesn't really matter.
  const symbol = ccy === 'USD' ? '$' : '';
  return `${symbol}${Number(n).toFixed(2)}`;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

/**
 * Word-wraps a long string into multiple lines that fit `maxWidth`.
 */
function fitText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface InvoicePdfOptions {
  /**
   * Base URL that the QR code should point at — usually the current origin.
   * The final QR target becomes `${baseUrl}/invoice/public/${invoice.id}`.
   *
   * If omitted, falls back to `window.location.origin` (browser only).
   */
  baseUrl?: string;

  /**
   * If provided, used in the "From / Issued by" block. Defaults to the
   * invoice's `owner.name` when populated.
   */
  issuerName?:    string;
  issuerEmail?:   string;
  issuerPhone?:   string;
  issuerAddress?: string;
}

/**
 * Generates the PDF and triggers a browser download.
 * Returns the filename so the caller can show a toast.
 */
export async function downloadInvoicePdf(
  invoice: Invoice,
  options: InvoicePdfOptions = {},
): Promise<string> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // ── Resolve QR target ────────────────────────────────────────────────────
  const baseUrl =
    options.baseUrl ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://handla.com');
  const qrTarget = `${baseUrl.replace(/\/$/, '')}/invoice/public/${invoice.id}`;

  // Pure black-on-white QR. High error correction tolerates scuff marks on
  // photocopied invoices.
  const qrDataUrl = await QRCode.toDataURL(qrTarget, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 512,
    color: { dark: '#000000', light: '#ffffff' },
  });

  // ── 1) Top section: three columns (Handla | QR | Invoice meta) ──────────
  //
  // No background fill — just black text on the white page. A single thin
  // black rule sits under the whole section to anchor the eye.

  const topY      = PAGE.margin;
  const topH      = 42;
  const contentW  = PAGE.width - PAGE.margin * 2;

  // ── 1a) Left column: Handla details ──────────────────────────────────────
  const leftX = PAGE.margin;
  let leftY   = topY + 5;

  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('HANDLA', leftX, leftY);

  leftY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Software services platform', leftX, leftY);

  leftY += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const handlaLines = [
    'Handla Tech',
    'hello@handla.com',
    'www.handla.com',
    'VAT / TRN: pending',
  ];
  handlaLines.forEach((line) => {
    doc.text(line, leftX, leftY);
    leftY += 3.8;
  });

  // ── 1b) Middle column: QR code ───────────────────────────────────────────
  const qrSize = 30;
  const qrX    = PAGE.margin + (contentW - qrSize) / 2;
  const qrY    = topY + 4;

  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  // Thin border around the QR so it stays visually crisp after photocopying
  setDraw(doc, BLACK);
  doc.setLineWidth(0.2);
  doc.rect(qrX - 0.6, qrY - 0.6, qrSize + 1.2, qrSize + 1.2);

  setText(doc, BLACK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Scan to view invoice online', qrX + qrSize / 2, qrY + qrSize + 4.5, { align: 'center' });

  // ── 1c) Right column: Invoice meta ───────────────────────────────────────
  const rightX = PAGE.margin + contentW;
  let rightY   = topY + 5;

  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('INVOICE', rightX, rightY, { align: 'right' });
  rightY += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.invoiceNumber, rightX, rightY, { align: 'right' });
  rightY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  // Label / value pairs aligned right
  const drawMeta = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, rightX - 32, rightY, { align: 'left' });
    doc.setFont('helvetica', 'bold');
    doc.text(value, rightX, rightY, { align: 'right' });
    rightY += 4.2;
  };

  drawMeta('Issued',  formatDate(invoice.createdAt));
  if (invoice.dueDate) drawMeta('Due',    formatDate(invoice.dueDate));
  if (invoice.paidAt)  drawMeta('Paid',   formatDate(invoice.paidAt));

  // Status — outlined box (no fill) so it photocopies clean
  const pillLabel = invoice.paymentStatus; // "UNPAID" | "PAID" | "OVERDUE"
  const pillW     = 28;
  const pillH     = 6.5;
  const pillX     = rightX - pillW;
  const pillY     = rightY + 1;

  setDraw(doc, BLACK);
  doc.setLineWidth(0.4);
  doc.rect(pillX, pillY, pillW, pillH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(pillLabel, pillX + pillW / 2, pillY + 4.4, { align: 'center' });

  // Thick black rule below the top section
  setDraw(doc, BLACK);
  doc.setLineWidth(0.6);
  doc.line(PAGE.margin, topY + topH, PAGE.width - PAGE.margin, topY + topH);

  // ── 2) Order details table ───────────────────────────────────────────────
  const tableStartY = topY + topH + 7;

  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ORDER DETAILS', PAGE.margin, tableStartY);

  const items = invoice.lineItems ?? [];
  const ccy   = invoice.currency || 'USD';

  autoTable(doc, {
    startY: tableStartY + 2.5,
    head: [['Description', 'Qty', 'Unit price', 'Line total']],
    body: items.map((li) => [
      li.description,
      String(Number(li.quantity)),
      formatCurrency(Number(li.unitPrice), ccy),
      formatCurrency(Number(li.lineTotal), ccy),
    ]),
    margin: { left: PAGE.margin, right: PAGE.margin },
    theme: 'plain',
    styles: {
      font:        'helvetica',
      fontSize:    9,
      cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 },
      textColor:   BLACK,
      lineColor:   BLACK,
      lineWidth:   0.15,
    },
    headStyles: {
      // Outlined header — no fill, just a bold black top + bottom rule
      fillColor:  WHITE,
      textColor:  BLACK,
      fontStyle:  'bold',
      fontSize:   9,
      halign:     'left',
      cellPadding: { top: 2.4, bottom: 2.4, left: 2.5, right: 2.5 },
      lineWidth:  { top: 0.6, bottom: 0.6, left: 0, right: 0 },
      lineColor:  BLACK,
    },
    bodyStyles: {
      lineWidth: { top: 0, bottom: 0.15, left: 0, right: 0 },
      lineColor: BLACK,
    },
    columnStyles: {
      0: { cellWidth: 'auto'                                       },
      1: { cellWidth: 18, halign: 'center'                          },
      2: { cellWidth: 32, halign: 'right'                           },
      3: { cellWidth: 32, halign: 'right', fontStyle: 'bold'        },
    },
    // No alternating row shading — keep it pure white
    didDrawPage: () => { /* header static — handled above */ },
  });

  // ── 3) Totals (right-aligned under the table) ────────────────────────────
  const afterTableY = (doc as any).lastAutoTable?.finalY ?? tableStartY + 30;
  const totalsX     = PAGE.width - PAGE.margin - 70;
  const totalsW     = 70;
  let   totalsY     = afterTableY + 5;

  const drawTotalLine = (label: string, value: string, bold = false) => {
    setText(doc, BLACK);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9);
    doc.text(label, totalsX + 2, totalsY);
    doc.text(value, totalsX + totalsW - 2, totalsY, { align: 'right' });
    totalsY += bold ? 6.5 : 4.5;
  };

  drawTotalLine('Subtotal', formatCurrency(Number(invoice.subtotal), ccy));
  if (Number(invoice.taxRate) > 0) {
    drawTotalLine(`Tax (${Number(invoice.taxRate)}%)`, formatCurrency(Number(invoice.taxAmount), ccy));
  }

  // Double black rule above the grand total — classic invoice convention
  setDraw(doc, BLACK);
  doc.setLineWidth(0.4);
  doc.line(totalsX + 2, totalsY - 1.8, totalsX + totalsW - 2, totalsY - 1.8);
  doc.line(totalsX + 2, totalsY - 0.6, totalsX + totalsW - 2, totalsY - 0.6);
  totalsY += 1.8;

  drawTotalLine('TOTAL', `${formatCurrency(Number(invoice.total), ccy)} ${ccy}`, true);

  // ── 4) Notes (optional — sits between totals and footer) ─────────────────
  let notesEndY = totalsY;
  if (invoice.notes) {
    const notesY = afterTableY + 5;
    if (notesY + 18 < PAGE.height - 70) {
      setText(doc, BLACK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('NOTES', PAGE.margin, notesY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      // Keep notes confined to the LEFT half so they don't collide with
      // the totals block on the right.
      const notesMaxW = totalsX - PAGE.margin - 6;
      const noteLines = fitText(doc, invoice.notes, notesMaxW);
      // Cap to 5 lines so the footer never collides with notes.
      noteLines.slice(0, 5).forEach((l, i) => {
        doc.text(l, PAGE.margin, notesY + 4 + i * 4);
      });
      notesEndY = Math.max(notesEndY, notesY + 4 + Math.min(5, noteLines.length) * 4);
    }
  }

  // ── 5) Bottom section: FROM (left) + BILLED TO (right) ───────────────────
  //
  // Anchored at a fixed Y so the layout looks consistent regardless of how
  // many line items the table contained.
  const footerY    = Math.max(notesEndY + 14, PAGE.height - 70);
  const footerColW = (contentW - 10) / 2;

  // Thin black divider above the parties row
  setDraw(doc, BLACK);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, footerY - 6, PAGE.width - PAGE.margin, footerY - 6);

  // 5a) FROM (left)
  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FROM', PAGE.margin, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Handla', PAGE.margin, footerY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const issuerLines: string[] = [];
  const issuerName = options.issuerName ?? invoice.owner?.name;
  if (issuerName) issuerLines.push(`Issued by ${issuerName}`);
  if (options.issuerEmail)   issuerLines.push(options.issuerEmail);
  else if (invoice.owner?.email) issuerLines.push(invoice.owner.email);
  if (options.issuerPhone)   issuerLines.push(options.issuerPhone);
  if (options.issuerAddress) issuerLines.push(options.issuerAddress);

  let issuerCursor = footerY + 10.5;
  issuerLines.forEach((line) => {
    fitText(doc, line, footerColW - 4).forEach((l) => {
      doc.text(l, PAGE.margin, issuerCursor);
      issuerCursor += 3.8;
    });
  });

  // Signature line
  const sigY = footerY + 36;
  setDraw(doc, BLACK);
  doc.setLineWidth(0.4);
  doc.line(PAGE.margin, sigY, PAGE.margin + 55, sigY);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.text('Authorized signature', PAGE.margin, sigY + 4);

  // When the invoice is already PAID we stamp a simple "PAID" marker above
  // the signature line. Pure outlined text, photocopy-friendly.
  if (invoice.paymentStatus === 'PAID') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('PAID', PAGE.margin + 2, sigY - 2);
  }

  // 5b) BILLED TO (right)
  const custX = PAGE.margin + footerColW + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BILLED TO', custX, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const clientCompany = invoice.client?.company ?? invoice.client?.user?.name ?? 'Customer';
  doc.text(clientCompany, custX, footerY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const customerLines: string[] = [];
  if (invoice.client?.company && invoice.client?.user?.name) {
    customerLines.push(`Attn: ${invoice.client.user.name}`);
  }
  if (invoice.client?.user?.email) customerLines.push(invoice.client.user.email);
  if ((invoice.client?.user as any)?.phoneNumber) {
    customerLines.push(String((invoice.client?.user as any).phoneNumber));
  }
  if ((invoice.client?.user as any)?.location) {
    customerLines.push(String((invoice.client?.user as any).location));
  }
  customerLines.push(`Client ID: ${invoice.clientId.slice(0, 8)}`);

  let custCursor = footerY + 10.5;
  customerLines.forEach((line) => {
    fitText(doc, line, footerColW - 4).forEach((l) => {
      doc.text(l, custX, custCursor);
      custCursor += 3.8;
    });
  });

  // ── 6) Page footer line ──────────────────────────────────────────────────
  setDraw(doc, BLACK);
  doc.setLineWidth(0.2);
  doc.line(PAGE.margin, PAGE.height - 14, PAGE.width - PAGE.margin, PAGE.height - 14);

  setText(doc, BLACK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Thank you for your business — Handla', PAGE.margin, PAGE.height - 9);
  doc.text(qrTarget, PAGE.width - PAGE.margin, PAGE.height - 9, { align: 'right' });

  // ── 7) Trigger download ──────────────────────────────────────────────────
  const safeNumber = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename   = `${safeNumber}.pdf`;
  doc.save(filename);
  return filename;
}
