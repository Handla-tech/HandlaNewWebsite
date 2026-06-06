/**
 * Invoice PDF Generator — Handla
 *
 * Generates a branded A4 PDF for a single invoice with the layout requested:
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │  [Handla details]      [QR code]       [Invoice meta]         │
 *   │   logo + contact       scan → opens    number / date / status │
 *   │                        public viewer                          │
 *   │ ─────────────────────────────────────────────────────────────  │
 *   │  Order details table (description / qty / unit / total)        │
 *   │  Subtotal / tax / TOTAL                                        │
 *   │ ─────────────────────────────────────────────────────────────  │
 *   │  [Issuer + signature]                 [Customer details]       │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Theme: brand dark page-style block in the header + gold accent (#fbbf24).
 * The rest of the page stays mostly light/grey so the PDF is print-friendly
 * (saves ink, photocopies cleanly).
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

// ─── Theme tokens (RGB so jsPDF can ingest them directly) ────────────────────

const COLOR = {
  // Brand
  gold:        [251, 191, 36] as [number, number, number], // #fbbf24
  goldDark:    [217, 119,  6] as [number, number, number], // #d97706
  // Surfaces
  dark:        [ 10,  10, 10] as [number, number, number], // #0a0a0a
  darkPanel:   [ 22,  22, 22] as [number, number, number],
  border:      [228, 228, 231] as [number, number, number], // light printable border
  // Text
  white:       [255, 255, 255] as [number, number, number],
  textPrimary: [ 17,  24, 39] as [number, number, number],  // near-black for body
  textMuted:   [107, 114, 128] as [number, number, number],
  textLight:   [156, 163, 175] as [number, number, number],
  // Status pills
  paid:        [ 16, 185, 129] as [number, number, number], // emerald-500
  unpaid:      [245, 158,  11] as [number, number, number], // amber-500
  overdue:     [239,  68,  68] as [number, number, number], // red-500
};

// ─── Layout constants (mm — jsPDF default unit) ──────────────────────────────

const PAGE = {
  width:   210, // A4 portrait
  height:  297,
  margin:  14,
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

function statusColor(status: string): [number, number, number] {
  if (status === 'PAID')    return COLOR.paid;
  if (status === 'OVERDUE') return COLOR.overdue;
  return COLOR.unpaid;
}

function formatCurrency(n: number, ccy: string): string {
  // Avoid locale-dependent currency symbol surprises in non-Latin locales —
  // keep a plain "$" for USD and the ISO code afterwards.
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
 * Splits a long string into lines that fit within `maxWidth`.
 * Uses jsPDF's built-in word-wrap for safety against long company names.
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

  // QR is rendered with a dark module color matching the brand surface.
  // High error correction tolerates Handla logos / scuff marks on prints.
  const qrDataUrl = await QRCode.toDataURL(qrTarget, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 512,
    color: {
      dark:  '#0a0a0a',
      light: '#ffffff',
    },
  });

  // ── 1) Header band ───────────────────────────────────────────────────────
  //
  // A dark band runs across the top, hosting three cells:
  //   left:   Handla brand block
  //   middle: QR code (on white card so scanners always work, even on print)
  //   right:  Invoice meta (number / dates / status)

  const headerY = PAGE.margin;
  const headerH = 55;
  const headerW = PAGE.width - PAGE.margin * 2;

  setFill(doc, COLOR.dark);
  doc.roundedRect(PAGE.margin, headerY, headerW, headerH, 3, 3, 'F');

  // Subtle gold underline strip
  setFill(doc, COLOR.gold);
  doc.rect(PAGE.margin, headerY + headerH - 1.2, headerW, 1.2, 'F');

  // ── 1a) Left cell: Handla details ────────────────────────────────────────
  const leftX = PAGE.margin + 6;
  let cursorY = headerY + 10;

  // Faux logo block — gold square with "H"
  setFill(doc, COLOR.gold);
  doc.roundedRect(leftX, cursorY - 5, 8, 8, 1.5, 1.5, 'F');
  setText(doc, COLOR.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('H', leftX + 4, cursorY + 0.7, { align: 'center' });

  setText(doc, COLOR.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Handla', leftX + 11, cursorY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, COLOR.textLight);
  doc.text('Software services platform', leftX + 11, cursorY + 4);

  cursorY += 12;
  doc.setFontSize(8);
  setText(doc, COLOR.white);
  doc.text('Handla Tech', leftX, cursorY);
  cursorY += 4;
  setText(doc, COLOR.textLight);
  doc.setFontSize(7.5);
  doc.text('hello@handla.com', leftX, cursorY);
  cursorY += 3.5;
  doc.text('www.handla.com', leftX, cursorY);
  cursorY += 3.5;
  doc.text('VAT / TRN: pending', leftX, cursorY);

  // ── 1b) Middle cell: QR code ─────────────────────────────────────────────
  //
  // The QR is placed on a small white card so contrast survives both screen
  // viewing of the PDF and printed/photocopied paper.
  const qrSize  = 34;
  const qrX     = PAGE.margin + (headerW - qrSize) / 2;
  const qrY     = headerY + (headerH - qrSize) / 2 - 1;

  setFill(doc, COLOR.white);
  doc.roundedRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 2, 2, 'F');
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  setText(doc, COLOR.textLight);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Scan to view invoice', qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' });

  // ── 1c) Right cell: Invoice meta ─────────────────────────────────────────
  const rightX = PAGE.margin + headerW - 6;
  let rightY  = headerY + 10;

  setText(doc, COLOR.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('INVOICE', rightX, rightY, { align: 'right' });
  rightY += 7;

  setText(doc, COLOR.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.invoiceNumber, rightX, rightY, { align: 'right' });
  rightY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, COLOR.textLight);
  doc.text('Issued', rightX - 26, rightY, { align: 'left' });
  setText(doc, COLOR.white);
  doc.text(formatDate(invoice.createdAt), rightX, rightY, { align: 'right' });
  rightY += 4;

  if (invoice.dueDate) {
    setText(doc, COLOR.textLight);
    doc.text('Due', rightX - 26, rightY, { align: 'left' });
    setText(doc, COLOR.white);
    doc.text(formatDate(invoice.dueDate), rightX, rightY, { align: 'right' });
    rightY += 4;
  }
  if (invoice.paidAt) {
    setText(doc, COLOR.textLight);
    doc.text('Paid', rightX - 26, rightY, { align: 'left' });
    setText(doc, COLOR.white);
    doc.text(formatDate(invoice.paidAt), rightX, rightY, { align: 'right' });
    rightY += 4;
  }

  // Status pill (anchored to right cell bottom)
  const pillColor = statusColor(invoice.paymentStatus);
  const pillLabel = invoice.paymentStatus;
  const pillW     = 26;
  const pillH     = 6.5;
  const pillX     = rightX - pillW;
  const pillY     = headerY + headerH - 11;
  setFill(doc, pillColor);
  doc.roundedRect(pillX, pillY, pillW, pillH, 3, 3, 'F');
  setText(doc, COLOR.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(pillLabel, pillX + pillW / 2, pillY + 4.4, { align: 'center' });

  // ── 2) Order details table ───────────────────────────────────────────────
  const tableStartY = headerY + headerH + 8;

  setText(doc, COLOR.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Order details', PAGE.margin, tableStartY);

  const items   = invoice.lineItems ?? [];
  const ccy     = invoice.currency || 'USD';

  autoTable(doc, {
    startY: tableStartY + 3,
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
      textColor:   COLOR.textPrimary,
      lineColor:   COLOR.border,
      lineWidth:   0.1,
    },
    headStyles: {
      fillColor:  COLOR.dark,
      textColor:  COLOR.white,
      fontStyle:  'bold',
      fontSize:   8.5,
      halign:     'left',
      cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
    },
    bodyStyles: {
      lineWidth: 0.1,
      lineColor: COLOR.border,
    },
    columnStyles: {
      0: { cellWidth: 'auto'                          },
      1: { cellWidth: 18, halign: 'center'            },
      2: { cellWidth: 32, halign: 'right'             },
      3: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didDrawPage: () => { /* keep header static — handled outside */ },
  });

  // ── 3) Totals box (right-aligned under the table) ────────────────────────
  const afterTableY = (doc as any).lastAutoTable?.finalY ?? tableStartY + 30;
  const totalsX     = PAGE.width - PAGE.margin - 70;
  const totalsW     = 70;
  let   totalsY     = afterTableY + 4;

  const drawTotalLine = (label: string, value: string, bold = false, accent = false) => {
    setText(doc, accent ? COLOR.goldDark : (bold ? COLOR.textPrimary : COLOR.textMuted));
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10 : 9);
    doc.text(label, totalsX + 2, totalsY);
    doc.text(value, totalsX + totalsW - 2, totalsY, { align: 'right' });
    totalsY += bold ? 6 : 4.5;
  };

  drawTotalLine('Subtotal', formatCurrency(Number(invoice.subtotal), ccy));
  if (Number(invoice.taxRate) > 0) {
    drawTotalLine(`Tax (${Number(invoice.taxRate)}%)`, formatCurrency(Number(invoice.taxAmount), ccy));
  }

  // Divider above the grand total
  setDraw(doc, COLOR.border);
  doc.setLineWidth(0.2);
  doc.line(totalsX + 2, totalsY - 1.5, totalsX + totalsW - 2, totalsY - 1.5);
  totalsY += 1.5;

  drawTotalLine('Total', `${formatCurrency(Number(invoice.total), ccy)} ${ccy}`, true, true);

  // ── 4) Footer: issuer (left) + customer (right) ──────────────────────────
  //
  // Anchored at a fixed Y so the layout looks consistent regardless of how
  // many line items the table contained.
  const footerY      = Math.max(totalsY + 10, PAGE.height - 65);
  const footerColW   = (PAGE.width - PAGE.margin * 2 - 8) / 2;

  // 4a) Issuer (left) — "From & signature"
  setText(doc, COLOR.textMuted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('FROM', PAGE.margin, footerY);

  setText(doc, COLOR.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Handla', PAGE.margin, footerY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setText(doc, COLOR.textMuted);

  const issuerLines: string[] = [];
  const issuerName = options.issuerName ?? invoice.owner?.name;
  if (issuerName) issuerLines.push(`Issued by ${issuerName}`);
  if (options.issuerEmail)   issuerLines.push(options.issuerEmail);
  else if (invoice.owner?.email) issuerLines.push(invoice.owner.email);
  if (options.issuerPhone)   issuerLines.push(options.issuerPhone);
  if (options.issuerAddress) issuerLines.push(options.issuerAddress);

  let issuerCursor = footerY + 10;
  issuerLines.forEach((line) => {
    fitText(doc, line, footerColW - 4).forEach((l) => {
      doc.text(l, PAGE.margin, issuerCursor);
      issuerCursor += 3.8;
    });
  });

  // Signature box
  const sigY  = footerY + 32;
  setDraw(doc, COLOR.border);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, sigY, PAGE.margin + 55, sigY);
  setText(doc, COLOR.textMuted);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text('Authorized signature', PAGE.margin, sigY + 4);

  // Gold "signed" mark when invoice is paid
  if (invoice.paymentStatus === 'PAID') {
    setText(doc, COLOR.goldDark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    // Slight italic-feel by using bold + small angled rotation
    doc.text('Handla', PAGE.margin + 2, sigY - 2);
  }

  // 4b) Customer (right) — "Billed to"
  const custX = PAGE.margin + footerColW + 8;
  setText(doc, COLOR.textMuted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('BILLED TO', custX, footerY);

  setText(doc, COLOR.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const clientCompany = invoice.client?.company ?? invoice.client?.user?.name ?? 'Customer';
  doc.text(clientCompany, custX, footerY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setText(doc, COLOR.textMuted);

  const customerLines: string[] = [];
  if (invoice.client?.company && invoice.client?.user?.name) {
    customerLines.push(`Attn: ${invoice.client.user.name}`);
  }
  if (invoice.client?.user?.email) customerLines.push(invoice.client.user.email);
  // Phone/address aren't stored on Client today; only show if user has them.
  if ((invoice.client?.user as any)?.phoneNumber) {
    customerLines.push(String((invoice.client?.user as any).phoneNumber));
  }
  if ((invoice.client?.user as any)?.location) {
    customerLines.push(String((invoice.client?.user as any).location));
  }
  customerLines.push(`Client ID: ${invoice.clientId.slice(0, 8)}`);

  let custCursor = footerY + 10;
  customerLines.forEach((line) => {
    fitText(doc, line, footerColW - 4).forEach((l) => {
      doc.text(l, custX, custCursor);
      custCursor += 3.8;
    });
  });

  // ── 5) Notes (above the footer if there are any) ─────────────────────────
  if (invoice.notes) {
    // Notes go between totals and footer — keep them concise; jsPDF auto-wraps.
    const notesY = afterTableY + 30;
    if (notesY + 20 < footerY) {
      setText(doc, COLOR.textMuted);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('NOTES', PAGE.margin, notesY);

      setText(doc, COLOR.textPrimary);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const noteLines = fitText(doc, invoice.notes, PAGE.width - PAGE.margin * 2);
      // Cap to 4 lines to avoid colliding with footer; rest is visible online.
      noteLines.slice(0, 4).forEach((l, i) => {
        doc.text(l, PAGE.margin, notesY + 4 + i * 4);
      });
    }
  }

  // ── 6) Page footer line ──────────────────────────────────────────────────
  setDraw(doc, COLOR.border);
  doc.setLineWidth(0.2);
  doc.line(PAGE.margin, PAGE.height - 14, PAGE.width - PAGE.margin, PAGE.height - 14);
  setText(doc, COLOR.textLight);
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
