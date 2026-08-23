/**
 * Invoice PDF Generator — Handla
 *
 * Professional, print-friendly A4 layout. Matches the design language of
 * the contract PDF (typographic section headers + key/value pairs + thin
 * rules) so both documents read as one family when printed back to back.
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │   HANDLA               [QR]                  INVOICE             │
 *   │   contact details      scan → viewer         number / dates pill │
 *   │ ═════════════════════════════════════════════════════════════════ │
 *   │ ──── ISSUED BY ─────────────  ──── BILLED TO ──────────────────   │
 *   │   Handla …                    Client …                            │
 *   │ ──── ORDER DETAILS ──────────────────────────────────────────────  │
 *   │   line-items table                                                │
 *   │                                          Subtotal     999.00      │
 *   │                                          Tax (5%)      49.95      │
 *   │                                          ═══════════════════════  │
 *   │                                          TOTAL    1,048.95 USD    │
 *   │ ──── NOTES ─────────────────────────────────────────────────────   │
 *   │   …                                                               │
 *   │ ──── SIGNATURE ─────────────────────────────────────────────────   │
 *   │   Handla signature line · Authorized representative               │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Design rules for B&W printing:
 *  - Pure black on white — no fills, no greys with low contrast.
 *  - Section headers are typographic, not boxed: bold caps + thin rule.
 *  - Labels are rendered in 50 %-tone grey only where contrast remains
 *    readable on photocopies; values stay 100 % black.
 *  - Status pill is an outlined box.
 *  - QR code uses error-correction level 'H' so it scans on faxes.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import type { Invoice } from '@/types';

// ─── Layout tokens ───────────────────────────────────────────────────────────

const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];
const GREY:  [number, number, number] = [90, 90, 90];

const PAGE = { width: 210, height: 297, margin: 18 };
const CONTENT_W = PAGE.width - PAGE.margin * 2;
const COL_GAP   = 8;
const COL_W     = (CONTENT_W - COL_GAP) / 2;

const HEADER_H = 44;
const FOOTER_H = 14;

// Page border — drawn 6 mm in from the physical page edge, outside content.
const BORDER_INSET = 6;
const BORDER_W = 0.4;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setText(doc: jsPDF, c: [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]); }
function setDraw(doc: jsPDF, c: [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]); }

/** Thin black border around the page (drawn outside the content margin). */
function drawPageBorder(doc: jsPDF) {
  setDraw(doc, BLACK);
  doc.setLineWidth(BORDER_W);
  doc.rect(
    BORDER_INSET,
    BORDER_INSET,
    PAGE.width  - BORDER_INSET * 2,
    PAGE.height - BORDER_INSET * 2,
  );
}

function formatCurrency(n: number, ccy: string): string {
  const symbol = ccy === 'USD' ? '$' : '';
  return `${symbol}${Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function fitText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

// Typographic section header — same as the contract PDF for visual consistency
function drawSectionHeader(doc: jsPDF, label: string, y: number): number {
  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(label.toUpperCase(), PAGE.margin, y);
  setDraw(doc, BLACK);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, y + 1.6, PAGE.width - PAGE.margin, y + 1.6);
  return y + 7;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface InvoicePdfOptions {
  /** Base URL the QR code should point at — usually window.location.origin. */
  baseUrl?: string;

  /**
   * INFO-01 — opaque public capability token. When provided, the QR code
   * targets the canonical token route (/invoice/public/token/:token) instead
   * of the legacy raw-id route. Callers should ensure a token exists (via
   * invoicesApi.generatePublicLink) before rendering a shareable PDF.
   */
  publicToken?: string | null;

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

  // Frame page 1 immediately. If the invoice ever paginates (it currently
  // doesn't — autoTable handles overflow in-page), the table's didDrawPage
  // hook below repaints the border on continuation pages too.
  drawPageBorder(doc);

  // ── Resolve QR target ────────────────────────────────────────────────────
  const baseUrl =
    options.baseUrl ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://handla.com');
  const root = baseUrl.replace(/\/$/, '');
  // INFO-01 — prefer the opaque capability-token route for NEW share links.
  // Fall back to the legacy raw-id route only when no token is available
  // (that route stays gated on the backend by PUBLIC_DOC_LEGACY_ID_LINKS).
  const token = options.publicToken ?? invoice.publicToken ?? null;
  const qrTarget = token
    ? `${root}/invoice/public/token/${token}`
    : `${root}/invoice/public/${invoice.id}`;

  const qrDataUrl = await QRCode.toDataURL(qrTarget, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 512,
    color: { dark: '#000000', light: '#ffffff' },
  });

  // ── 1) Top header — 3 columns ────────────────────────────────────────────
  const topY = PAGE.margin;

  // 1a) Left — Handla details
  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('HANDLA', PAGE.margin, topY + 5);

  setText(doc, GREY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text('Software services platform', PAGE.margin, topY + 9.5);

  setText(doc, BLACK);
  doc.setFontSize(8.5);
  let leftY = topY + 16;
  ['Handla Tech', 'hello@handla.com', 'www.handla.com', 'VAT / TRN: pending'].forEach((line) => {
    doc.text(line, PAGE.margin, leftY);
    leftY += 3.8;
  });

  // 1b) Middle — QR code
  const qrSize = 28;
  const qrX = PAGE.margin + (CONTENT_W - qrSize) / 2;
  const qrY = topY + 3;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  setDraw(doc, BLACK);
  doc.setLineWidth(0.2);
  doc.rect(qrX - 0.7, qrY - 0.7, qrSize + 1.4, qrSize + 1.4);
  setText(doc, GREY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text('Scan to view invoice online', qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' });

  // 1c) Right — Invoice meta
  const rightX = PAGE.margin + CONTENT_W;
  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('INVOICE', rightX, topY + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.invoiceNumber, rightX, topY + 13, { align: 'right' });

  let metaY = topY + 19;
  const drawMeta = (label: string, value: string) => {
    setText(doc, GREY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(label, rightX - 32, metaY, { align: 'left' });
    setText(doc, BLACK);
    doc.setFont('helvetica', 'bold');
    doc.text(value, rightX, metaY, { align: 'right' });
    metaY += 4.2;
  };
  drawMeta('Issued', formatDate(invoice.createdAt));
  if (invoice.dueDate) drawMeta('Due',  formatDate(invoice.dueDate));
  if (invoice.paidAt)  drawMeta('Paid', formatDate(invoice.paidAt));

  // Status pill — outlined
  const pillW = 28;
  const pillH = 6.5;
  const pillX = rightX - pillW;
  const pillY = metaY + 1;
  setDraw(doc, BLACK);
  doc.setLineWidth(0.4);
  doc.rect(pillX, pillY, pillW, pillH);
  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(invoice.paymentStatus, pillX + pillW / 2, pillY + 4.4, { align: 'center' });

  // Thick black rule below the top section
  setDraw(doc, BLACK);
  doc.setLineWidth(0.6);
  doc.line(PAGE.margin, topY + HEADER_H, PAGE.width - PAGE.margin, topY + HEADER_H);

  let cursor = topY + HEADER_H + 8;

  // ── 2) Parties row (ISSUED BY · BILLED TO) ───────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, GREY);
  doc.text('ISSUED BY', PAGE.margin, cursor);
  doc.text('BILLED TO', PAGE.margin + COL_W + COL_GAP, cursor);

  // Issuer column
  const issuerName  = options.issuerName  ?? invoice.owner?.name;
  const issuerEmail = options.issuerEmail ?? invoice.owner?.email;

  const issuerLines: string[] = [];
  issuerLines.push('Handla');
  if (issuerName)            issuerLines.push(`Representative: ${issuerName}`);
  if (issuerEmail)           issuerLines.push(issuerEmail);
  if (options.issuerPhone)   issuerLines.push(options.issuerPhone);
  if (options.issuerAddress) issuerLines.push(options.issuerAddress);

  // Customer column
  const clientCompany = invoice.client?.company ?? invoice.client?.user?.name ?? 'Customer';
  const clientName    = invoice.client?.user?.name ?? null;
  const customerLines: string[] = [];
  customerLines.push(clientCompany);
  if (clientName && clientName !== clientCompany) customerLines.push(`Attn: ${clientName}`);
  if (invoice.client?.user?.email)                customerLines.push(invoice.client.user.email);
  if ((invoice.client?.user as any)?.phoneNumber) customerLines.push(String((invoice.client?.user as any).phoneNumber));
  if ((invoice.client?.user as any)?.location)    customerLines.push(String((invoice.client?.user as any).location));
  customerLines.push(`Client ID: ${invoice.clientId.slice(0, 8)}`);

  const partyTopY = cursor + 4.5;
  const drawPartyCol = (lines: string[], x: number) => {
    let y = partyTopY;
    lines.forEach((line, i) => {
      const wrapped = fitText(doc, line, COL_W - 2);
      wrapped.forEach((wl) => {
        if (i === 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          setText(doc, BLACK);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.8);
          setText(doc, BLACK);
        }
        doc.text(wl, x, y);
        y += i === 0 ? 5 : 4.4;
      });
    });
    return y;
  };
  const issuerEnd   = drawPartyCol(issuerLines,   PAGE.margin);
  const customerEnd = drawPartyCol(customerLines, PAGE.margin + COL_W + COL_GAP);
  cursor = Math.max(issuerEnd, customerEnd) + 4;

  // ── 3) Order details — line items table ──────────────────────────────────
  cursor = drawSectionHeader(doc, 'Order Details', cursor);

  const items = invoice.lineItems ?? [];
  const ccy   = invoice.currency || 'USD';

  autoTable(doc, {
    startY: cursor,
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
      fillColor:   WHITE,
      textColor:   BLACK,
      fontStyle:   'bold',
      fontSize:    8.8,
      halign:      'left',
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
      lineWidth:   { top: 0.5, bottom: 0.5, left: 0, right: 0 },
      lineColor:   BLACK,
    },
    bodyStyles: {
      lineWidth: { top: 0, bottom: 0.15, left: 0, right: 0 },
      lineColor: BLACK,
    },
    columnStyles: {
      0: { cellWidth: 'auto'                                  },
      1: { cellWidth: 16, halign: 'center'                     },
      2: { cellWidth: 32, halign: 'right'                      },
      3: { cellWidth: 32, halign: 'right', fontStyle: 'bold'   },
    },
    didDrawPage: (data) => {
      // Repaint the page border on any continuation page autoTable spawns.
      // (Currently invoices fit on one page, but if a future invoice has
      // enough line-items to overflow, continuation pages still get framed.)
      if (data.pageNumber > 1) drawPageBorder(doc);
    },
  });

  cursor = ((doc as any).lastAutoTable?.finalY ?? cursor + 30) + 5;

  // ── 4) Totals block (right-aligned) ──────────────────────────────────────
  const totalsX = PAGE.width - PAGE.margin - 72;
  const totalsW = 72;
  let totalsY   = cursor;

  const drawTotalLine = (label: string, value: string, bold = false) => {
    setText(doc, bold ? BLACK : GREY);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9);
    doc.text(label, totalsX + 2, totalsY);
    setText(doc, BLACK);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(value, totalsX + totalsW - 2, totalsY, { align: 'right' });
    totalsY += bold ? 6.5 : 4.6;
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
  totalsY += 1.6;

  drawTotalLine('TOTAL', `${formatCurrency(Number(invoice.total), ccy)} ${ccy}`, true);

  cursor = totalsY + 6;

  // ── 5) Notes (optional) ──────────────────────────────────────────────────
  if (invoice.notes && invoice.notes.trim()) {
    // If the notes wouldn't fit alongside or below totals, advance cursor
    cursor = drawSectionHeader(doc, 'Notes', cursor);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setText(doc, BLACK);
    const noteLines = fitText(doc, invoice.notes, CONTENT_W);
    // Cap to ~8 lines so the signature block has room.
    const visible = noteLines.slice(0, 8);
    visible.forEach((l) => {
      doc.text(l, PAGE.margin, cursor);
      cursor += 4.4;
    });
    cursor += 2;
  }

  // ── 6) Signature ─────────────────────────────────────────────────────────
  //
  // Pin the signature block near the bottom so the document anchors visually
  // regardless of how many line items the table contained.
  const sigBlockH = 28;
  const sigBlockY = Math.max(cursor + 6, PAGE.height - FOOTER_H - sigBlockH - 4);

  drawSectionHeader(doc, 'Signature', sigBlockY);
  const sigLineY = sigBlockY + 18;

  if (invoice.paymentStatus === 'PAID') {
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(13);
    setText(doc, BLACK);
    doc.text('PAID', PAGE.margin + 2, sigLineY - 1.5);
  }

  setDraw(doc, BLACK);
  doc.setLineWidth(0.4);
  doc.line(PAGE.margin, sigLineY, PAGE.margin + 75, sigLineY);

  setText(doc, BLACK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(issuerName ?? 'Handla', PAGE.margin, sigLineY + 4);

  setText(doc, GREY);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text('Authorized representative', PAGE.margin, sigLineY + 7.5);
  if (invoice.paidAt && invoice.paymentStatus === 'PAID') {
    doc.text(`Paid on: ${formatDate(invoice.paidAt)}`, PAGE.margin, sigLineY + 10.8);
  }

  // ── 7) Page footer ───────────────────────────────────────────────────────
  setDraw(doc, BLACK);
  doc.setLineWidth(0.2);
  doc.line(PAGE.margin, PAGE.height - FOOTER_H, PAGE.width - PAGE.margin, PAGE.height - FOOTER_H);

  setText(doc, BLACK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Thank you for your business — Handla', PAGE.margin, PAGE.height - 8);
  doc.text(qrTarget, PAGE.width - PAGE.margin, PAGE.height - 8, { align: 'right' });

  // ── 8) Download ──────────────────────────────────────────────────────────
  const safeNumber = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename   = `${safeNumber}.pdf`;
  doc.save(filename);
  return filename;
}
