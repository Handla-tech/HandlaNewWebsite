/**
 * Contract PDF Generator — Handla
 *
 * Professional, print-friendly A4 layout. Pure black-and-white so the
 * document photocopies and faxes without losing legibility, but built on
 * typographic hierarchy (label spacing, weight contrast, section rules)
 * rather than colour fills or boxed frames.
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │   HANDLA               [QR]                  CONTRACT          │
 *   │   contact details      scan → viewer         ref / dates / pill │
 *   │ ════════════════════════════════════════════════════════════════ │
 *   │   Contract title                                                │
 *   │ ──── ISSUED BY ─────────────  ──── CONTRACTED WITH ──────────   │
 *   │   Handla …                    Client …                          │
 *   │ ──── CONTRACT INFORMATION ─────────────────────────────────────  │
 *   │   key: value rows                                               │
 *   │ ──── PROJECT DETAILS ──────────────────────────────────────────  │
 *   │   prose                                                         │
 *   │ ──── PAYMENT SCHEDULE ─────────────────────────────────────────  │
 *   │   tabular milestones                                            │
 *   │   …                                                             │
 *   │ ──── SIGNATURES ───────────────────────────────────────────────  │
 *   │   handla line · authorized rep      client line · signed name    │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * Rendering strategy:
 *  - When the contract carries a structured `details` payload (the
 *    authenticated `/erp/contracts/:id` endpoint and the sanitized
 *    `/erp/contracts/public/:id` endpoint both return it), the PDF is
 *    rendered field-by-field as styled sections. This is the path the
 *    user sees today.
 *  - When `details` is missing (legacy contracts created with a hand-
 *    written body), we fall back to printing `body` as pre-wrapped prose
 *    — but we strip any leftover non-ASCII section dividers first so
 *    we don't get mojibake (jsPDF's WinAnsi Helvetica can't render box-
 *    drawing characters like `═`).
 *  - Both paths share the same header / signatures / footer chrome.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import type {
  Contract,
  ContractDetails,
  ContractType,
  OwnershipType,
  PaymentMilestone,
} from '@/types';

// ─── Layout tokens ───────────────────────────────────────────────────────────

const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];

const PAGE = { width: 210, height: 297, margin: 18 };
const CONTENT_W = PAGE.width - PAGE.margin * 2;
const COL_GAP   = 8;
const COL_W     = (CONTENT_W - COL_GAP) / 2;

const HEADER_H  = 44;
const FOOTER_H  = 14;
const PAGE_BOTTOM = PAGE.height - FOOTER_H; // hard limit for any content

// Page border — drawn 6 mm in from the physical page edge on all four sides.
// Sits OUTSIDE the content margin so it never collides with text.
const BORDER_INSET = 6;
const BORDER_W = 0.4;

// ─── Drawing primitives ──────────────────────────────────────────────────────

function setText(doc: jsPDF, c: [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]); }
function setDraw(doc: jsPDF, c: [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]); }

/**
 * Single thin black border around the page. Drawn once per page (call
 * from the page-creation hook). Sits 6 mm in from each physical edge,
 * which is OUTSIDE the content margin (18 mm) so it never overlaps text.
 */
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

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function formatCurrency(amount: number | null | undefined, ccy?: string | null): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  const ccyStr = (ccy || 'USD').toUpperCase();
  const formatted = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${ccyStr} ${formatted}`;
}

const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  FIXED_PRICE:  'Fixed Price',
  HOURLY:       'Hourly',
  RETAINER:     'Retainer',
  MILESTONE:    'Milestone-based',
  MAINTENANCE:  'Maintenance',
  CONSULTATION: 'Consultation',
};

const OWNERSHIP_LABEL: Record<OwnershipType, string> = {
  CLIENT_OWNS_EVERYTHING:            'Client owns all deliverables',
  OWNERSHIP_TRANSFERS_AFTER_PAYMENT: 'Ownership transfers after full payment',
  SHARED_OWNERSHIP:                  'Shared ownership',
};

function yn(v: boolean | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  return v ? 'Yes' : 'No';
}

/**
 * Does this ContractDetails carry any data worth rendering? If every meaningful
 * field is missing / empty, the structured renderer would emit a contract
 * with only the PARTIES block — so we'd rather fall through to the legacy
 * body parser which at least has narrative content.
 */
function hasAnyDetailsContent(d: ContractDetails): boolean {
  const stringFields: (keyof ContractDetails)[] = [
    'contractNumber', 'projectName',
    'projectDescription', 'scopeOfWork',
    'startDate', 'endDate', 'estimatedDuration',
    'currency', 'warrantyPeriod', 'supportPeriod',
    'latePaymentPenalty', 'terminationTerms', 'termsAndConditions',
  ];
  for (const k of stringFields) {
    const v = d[k];
    if (typeof v === 'string' && v.trim() !== '') return true;
  }
  if (d.contractType || d.ownershipType) return true;
  if (typeof d.totalValue === 'number') return true;
  if (typeof d.freeRevisions === 'number') return true;
  if (typeof d.acceptancePeriodDays === 'number') return true;
  if (d.deliverables       && d.deliverables.length       > 0) return true;
  if (d.excludedServices   && d.excludedServices.length   > 0) return true;
  if (d.paymentMilestones  && d.paymentMilestones.length  > 0) return true;
  return false;
}

/**
 * Sanitize a legacy plain-text contract body.
 *
 * 1) Replace box-drawing / em-dash characters that jsPDF's WinAnsi-encoded
 *    Helvetica can't render (would otherwise show as `%P%P%P…` mojibake).
 * 2) **Strip** dashed divider rows entirely (any line that's purely "-" and
 *    whitespace, 4+ chars) — these were intended as visual separators in
 *    the plain-text view, but in the PDF we paint proper typographic rules
 *    via drawSectionHeader, so the literal dashes become noise.
 * 3) Strip zero-width / BOM control chars.
 * 4) Collapse 3+ consecutive blank lines into a single blank line.
 */
function sanitizeBody(body: string): string {
  return body
    .replace(/[\u2500-\u257F\u2014\u2013]/g, '-')
    .replace(/[\u200B-\u200F\uFEFF]/g, '')
    .split('\n')
    .filter((line) => !/^\s*-{4,}\s*$/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Parse a sanitised legacy body into named sections. The legacy renderer
 * emitted sections as:
 *
 *     SECTION TITLE
 *     <content lines…>
 *
 * (with dashed dividers we've already stripped). A "section title" line is
 * detected as a line that is ALL UPPERCASE (with optional &/and/+), shorter
 * than 50 chars, and followed by at least one non-empty content line.
 *
 * Returns the document as an ordered list of (title, body) pairs. If no
 * sections can be detected, returns a single anonymous section with the
 * whole body as content.
 */
function parseLegacyBodySections(body: string): Array<{ title: string; content: string }> {
  const lines = body.split('\n');
  const isSectionTitle = (line: string): boolean => {
    const t = line.trim();
    if (t.length === 0 || t.length > 50) return false;
    // All caps + spaces + & + a few connectors. No lowercase.
    return /^[A-Z0-9 &/+\-,.()]+$/.test(t) && /[A-Z]/.test(t) && t === t.toUpperCase();
  };

  const sections: Array<{ title: string; content: string[] }> = [];
  let current: { title: string; content: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] ?? '';
    if (isSectionTitle(line) && next.trim().length > 0) {
      if (current) sections.push(current);
      current = { title: line.trim(), content: [] };
      continue;
    }
    if (current) current.content.push(line);
    else if (line.trim().length > 0) {
      current = { title: '', content: [line] };
    }
  }
  if (current) sections.push(current);

  if (sections.length === 0) {
    return [{ title: '', content: body.trim() }];
  }
  return sections.map((s) => ({
    title: s.title,
    content: s.content.join('\n').replace(/^\n+|\n+$/g, ''),
  }));
}

// ─── Section primitives ──────────────────────────────────────────────────────
//
// Every drawing function takes a mutable cursor (the current Y position).
// They return the new cursor position so callers can chain them.

interface DrawContext {
  doc: jsPDF;
  cursor: number;
  qrTarget: string;
  contractRef: string;
  contractTitle: string;
  pageNumber: number;
}

/** Footer + page-break helper. Adds a new page if `needed` mm wouldn't fit. */
function ensureSpace(ctx: DrawContext, needed: number) {
  if (ctx.cursor + needed > PAGE_BOTTOM - 6) {
    drawFooter(ctx);
    ctx.doc.addPage();
    ctx.pageNumber += 1;
    ctx.cursor = drawContinuationHeader(ctx);
  }
}

function drawFooter(ctx: DrawContext) {
  const { doc } = ctx;
  setDraw(doc, BLACK);
  doc.setLineWidth(0.2);
  doc.line(PAGE.margin, PAGE.height - FOOTER_H, PAGE.width - PAGE.margin, PAGE.height - FOOTER_H);
  setText(doc, BLACK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Handla contract — confidential', PAGE.margin, PAGE.height - 8);
  doc.text(
    `Page ${ctx.pageNumber}`,
    PAGE.width / 2,
    PAGE.height - 8,
    { align: 'center' },
  );
  doc.text(ctx.qrTarget, PAGE.width - PAGE.margin, PAGE.height - 8, { align: 'right' });
}

/** Lightweight header on continuation pages — returns the body start Y. */
function drawContinuationHeader(ctx: DrawContext): number {
  const { doc } = ctx;

  // Page border first so it sits behind everything else.
  drawPageBorder(doc);

  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`CONTRACT · ${ctx.contractRef}`, PAGE.margin, PAGE.margin + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const title = (doc.splitTextToSize(ctx.contractTitle, CONTENT_W - 30) as string[])[0] ?? '';
  doc.text(title, PAGE.margin, PAGE.margin + 7.5);

  setDraw(doc, BLACK);
  doc.setLineWidth(0.2);
  doc.line(PAGE.margin, PAGE.margin + 10, PAGE.width - PAGE.margin, PAGE.margin + 10);
  return PAGE.margin + 16;
}

/**
 * Section heading: ALL-CAPS bold label with a thin rule underneath. This is
 * the typographic unit the whole document hangs off — works equally well in
 * print and on screen.
 */
function drawSectionHeader(ctx: DrawContext, label: string) {
  ensureSpace(ctx, 12);
  const { doc } = ctx;
  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  // Letter-spacing trick: jsPDF doesn't support tracking so we space the
  // label by inserting a hair-thin character. Keeping the label as-is is
  // fine; the bold weight + rule already give it enough presence.
  doc.text(label.toUpperCase(), PAGE.margin, ctx.cursor);
  setDraw(doc, BLACK);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, ctx.cursor + 1.6, PAGE.width - PAGE.margin, ctx.cursor + 1.6);
  ctx.cursor += 7;
}

/**
 * 2-column key/value list. Renders as many rows per column as possible
 * before wrapping into a second column on the right.
 */
function drawKvRows(ctx: DrawContext, rows: Array<[string, string]>) {
  if (rows.length === 0) return;
  const { doc } = ctx;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, BLACK);

  const labelW = 38;        // mm reserved for the label
  const lineH  = 4.6;       // mm per row

  // Split into two columns (left then right) so we use horizontal space
  const half = Math.ceil(rows.length / 2);
  const leftCol  = rows.slice(0, half);
  const rightCol = rows.slice(half);

  const blockH = Math.max(leftCol.length, rightCol.length) * lineH;
  ensureSpace(ctx, blockH + 4);

  const startY = ctx.cursor;

  const drawCol = (colRows: Array<[string, string]>, x: number) => {
    let y = startY;
    colRows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal');
      setText(doc, [90, 90, 90]); // soft grey label — still high contrast on B&W
      doc.text(label, x, y);
      doc.setFont('helvetica', 'bold');
      setText(doc, BLACK);
      const valLines = doc.splitTextToSize(value, COL_W - labelW - 2) as string[];
      doc.text(valLines[0] ?? '', x + labelW, y);
      // additional wrapped lines
      for (let i = 1; i < valLines.length; i++) {
        y += lineH;
        doc.text(valLines[i], x + labelW, y);
      }
      y += lineH;
    });
    return y;
  };

  const leftEnd  = drawCol(leftCol,  PAGE.margin);
  const rightEnd = drawCol(rightCol, PAGE.margin + COL_W + COL_GAP);

  ctx.cursor = Math.max(leftEnd, rightEnd) + 2;

  // Reset text colour to black for whatever runs next
  setText(doc, BLACK);
}

/** Multi-line prose block with a small label sitting above it. */
function drawProseBlock(ctx: DrawContext, label: string, text: string) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return;
  const { doc } = ctx;
  ensureSpace(ctx, 10);

  // Only draw the grey label row if one was actually supplied. Calling sites
  // pass '' when the surrounding section header already conveys the label,
  // and printing an empty bolded line still consumes vertical space.
  if (label.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setText(doc, [90, 90, 90]);
    doc.text(label.toUpperCase(), PAGE.margin, ctx.cursor);
    ctx.cursor += 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setText(doc, BLACK);
  const lines = doc.splitTextToSize(trimmed, CONTENT_W) as string[];
  const lineH = 4.4;

  // Print lines one-by-one so we paginate cleanly across pages
  for (const line of lines) {
    ensureSpace(ctx, lineH);
    doc.text(line, PAGE.margin, ctx.cursor);
    ctx.cursor += lineH;
  }
  ctx.cursor += 2;
}

/** Bulleted list under a small label. */
function drawBulletList(ctx: DrawContext, label: string, items: string[]) {
  const cleaned = (items ?? []).map((s) => (s ?? '').trim()).filter((s) => s.length > 0);
  if (cleaned.length === 0) return;
  const { doc } = ctx;
  ensureSpace(ctx, 10);

  if (label.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setText(doc, [90, 90, 90]);
    doc.text(label.toUpperCase(), PAGE.margin, ctx.cursor);
    ctx.cursor += 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setText(doc, BLACK);
  const lineH = 4.4;
  for (const item of cleaned) {
    const wrapped = doc.splitTextToSize(item, CONTENT_W - 5) as string[];
    for (let i = 0; i < wrapped.length; i++) {
      ensureSpace(ctx, lineH);
      const prefix = i === 0 ? '\u2022  ' : '   ';
      doc.text(prefix + wrapped[i], PAGE.margin, ctx.cursor);
      ctx.cursor += lineH;
    }
  }
  ctx.cursor += 1.5;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ContractPdfOptions {
  /** Base URL the QR code should point at. */
  baseUrl?: string;

  /**
   * INFO-01 — opaque public capability token. When provided, the QR code
   * targets the canonical token route (/contract/public/token/:token) instead
   * of the legacy raw-id route. Callers should ensure a token exists (via
   * contractsApi.generatePublicLink) before rendering a shareable PDF.
   */
  publicToken?: string | null;

  /** Issuer overrides — fall back to contract.owner when not provided. */
  issuerName?:    string;
  issuerEmail?:   string;
  issuerPhone?:   string;
  issuerAddress?: string;
}

/**
 * Generates the contract PDF and triggers a browser download.
 * Returns the filename so the caller can show a toast.
 */
export async function downloadContractPdf(
  contract: Contract,
  options: ContractPdfOptions = {},
): Promise<string> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Frame the first page. Subsequent pages get framed in drawContinuationHeader
  // and in the autoTable didDrawPage hook.
  drawPageBorder(doc);

  // ── Resolve QR target ────────────────────────────────────────────────────
  const baseUrl =
    options.baseUrl ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://handla.com');
  const root = baseUrl.replace(/\/$/, '');
  // INFO-01 — prefer the opaque capability-token route for NEW share links.
  // Fall back to the legacy raw-id route only when no token is available
  // (that route stays gated on the backend by PUBLIC_DOC_LEGACY_ID_LINKS).
  const token = options.publicToken ?? contract.publicToken ?? null;
  const qrTarget = token
    ? `${root}/contract/public/token/${token}`
    : `${root}/contract/public/${contract.id}`;

  const qrDataUrl = await QRCode.toDataURL(qrTarget, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 512,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const contractRef = contract.id.slice(0, 8).toUpperCase();
  const details: ContractDetails | null | undefined = contract.details;

  // ── 1) Top header — 3 columns ────────────────────────────────────────────
  const topY = PAGE.margin;
  let cursor = topY + 5;

  // 1a) Left column — Handla details
  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('HANDLA', PAGE.margin, cursor);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  setText(doc, [90, 90, 90]);
  doc.text('Software services platform', PAGE.margin, cursor + 4.5);

  setText(doc, BLACK);
  doc.setFontSize(8.5);
  let leftY = cursor + 11;
  ['Handla Tech', 'hello@handla.com', 'www.handla.com', 'VAT / TRN: pending'].forEach((line) => {
    doc.text(line, PAGE.margin, leftY);
    leftY += 3.8;
  });

  // 1b) Middle column — QR code
  const qrSize = 28;
  const qrX = PAGE.margin + (CONTENT_W - qrSize) / 2;
  const qrY = topY + 3;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  setDraw(doc, BLACK);
  doc.setLineWidth(0.2);
  doc.rect(qrX - 0.7, qrY - 0.7, qrSize + 1.4, qrSize + 1.4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  setText(doc, [90, 90, 90]);
  doc.text('Scan to view contract online', qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' });

  // 1c) Right column — Contract meta
  const rightX = PAGE.margin + CONTENT_W;
  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('CONTRACT', rightX, topY + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Ref: ${contractRef}`, rightX, topY + 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  let metaY = topY + 19;
  const drawMeta = (label: string, value: string) => {
    setText(doc, [90, 90, 90]);
    doc.setFont('helvetica', 'normal');
    doc.text(label, rightX - 32, metaY, { align: 'left' });
    setText(doc, BLACK);
    doc.setFont('helvetica', 'bold');
    doc.text(value, rightX, metaY, { align: 'right' });
    metaY += 4.2;
  };
  drawMeta('Created', formatDate(contract.createdAt));
  if (contract.sentAt)   drawMeta('Sent',   formatDate(contract.sentAt));
  if (contract.signedAt) drawMeta('Signed', formatDate(contract.signedAt));

  // Status pill — outlined box
  const pillW = 28;
  const pillH = 6.5;
  const pillX = rightX - pillW;
  const pillY = metaY + 1;
  setDraw(doc, BLACK);
  doc.setLineWidth(0.4);
  doc.rect(pillX, pillY, pillW, pillH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, BLACK);
  doc.text(contract.status, pillX + pillW / 2, pillY + 4.4, { align: 'center' });

  // Thick black rule below the top section
  setDraw(doc, BLACK);
  doc.setLineWidth(0.6);
  doc.line(PAGE.margin, topY + HEADER_H, PAGE.width - PAGE.margin, topY + HEADER_H);

  cursor = topY + HEADER_H + 7;

  // Build context now that the chrome is drawn (page 1)
  const ctx: DrawContext = {
    doc,
    cursor,
    qrTarget,
    contractRef,
    contractTitle: contract.title,
    pageNumber: 1,
  };

  // ── 2) Contract title row ────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setText(doc, BLACK);
  const titleLines = doc.splitTextToSize(contract.title, CONTENT_W) as string[];
  titleLines.slice(0, 2).forEach((line) => {
    doc.text(line, PAGE.margin, ctx.cursor);
    ctx.cursor += 6;
  });
  ctx.cursor += 2;

  // ── 3) Parties row ───────────────────────────────────────────────────────
  drawSectionHeader(ctx, 'Parties');

  const issuerLines: string[] = [];
  issuerLines.push('Handla');
  const issuerName = options.issuerName ?? contract.owner?.name;
  if (issuerName) issuerLines.push(`Representative: ${issuerName}`);
  if (options.issuerEmail)         issuerLines.push(options.issuerEmail);
  else if (contract.owner?.email)  issuerLines.push(contract.owner.email);
  if (options.issuerPhone)         issuerLines.push(options.issuerPhone);
  if (options.issuerAddress)       issuerLines.push(options.issuerAddress);

  // Prefer details.clientCompany/name/email/phone/address (form-supplied) before
  // falling back to the relational client record. Dynamic form data wins.
  const clientCompany =
    details?.clientCompany?.trim() ||
    contract.client?.company ||
    contract.client?.user?.name ||
    'Client';
  const clientName =
    details?.clientName?.trim() ||
    contract.client?.user?.name ||
    null;
  const clientEmail =
    details?.clientEmail?.trim() ||
    contract.client?.user?.email ||
    null;
  const clientPhone =
    details?.clientPhone?.trim() ||
    (contract.client?.user as any)?.phoneNumber ||
    null;
  const clientAddress =
    details?.clientAddress?.trim() ||
    (contract.client?.user as any)?.location ||
    null;

  const customerLines: string[] = [];
  customerLines.push(clientCompany);
  if (clientName && clientName !== clientCompany) customerLines.push(`Attn: ${clientName}`);
  if (clientEmail)   customerLines.push(clientEmail);
  if (clientPhone)   customerLines.push(String(clientPhone));
  if (clientAddress) customerLines.push(String(clientAddress));
  customerLines.push(`Client ID: ${contract.clientId.slice(0, 8)}`);

  // Compute the maximum height the parties block needs so both columns align
  const partyLineH = 4.4;
  const issuedByY  = ctx.cursor;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, [90, 90, 90]);
  doc.text('ISSUED BY', PAGE.margin, issuedByY);
  doc.text('CONTRACTED WITH', PAGE.margin + COL_W + COL_GAP, issuedByY);

  setText(doc, BLACK);
  const drawPartyCol = (lines: string[], x: number) => {
    let y = issuedByY + 4.5;
    lines.forEach((line, i) => {
      const wrapped = doc.splitTextToSize(line, COL_W - 2) as string[];
      wrapped.forEach((wl) => {
        if (i === 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.8);
        }
        doc.text(wl, x, y);
        y += i === 0 ? 5 : partyLineH;
      });
    });
    return y;
  };
  const issuedEnd  = drawPartyCol(issuerLines,   PAGE.margin);
  const contractEnd = drawPartyCol(customerLines, PAGE.margin + COL_W + COL_GAP);
  ctx.cursor = Math.max(issuedEnd, contractEnd) + 4;

  // ── 4) Structured details OR fallback to body prose ──────────────────────
  //
  // We prefer the structured `details` payload (renders as typographic
  // sections, no dashed dividers). Empty/sparse details fall through to
  // the legacy body parser so we still surface content for old contracts.
  const hasUsefulDetails = !!details && hasAnyDetailsContent(details);
  if (hasUsefulDetails) {
    renderStructuredDetails(ctx, details!);
  } else {
    // Legacy plain-text body — parse it into typographic sections so it
    // renders with the same look-and-feel as a structured contract instead
    // of dumping raw "DASHED DIVIDER\nSECTION\nDASHED DIVIDER" runs.
    const sanitized = sanitizeBody(contract.body || '');
    const sections = parseLegacyBodySections(sanitized);
    sections.forEach((s) => {
      if (s.title) drawSectionHeader(ctx, s.title);
      if (s.content.trim()) drawProseBlock(ctx, '', s.content);
    });
  }

  // ── 5) Signatures ────────────────────────────────────────────────────────
  // Reserve at least 42 mm for the signatures block at the bottom of the
  // current page (or start a new page if there's no room).
  const SIG_BLOCK_H = 42;
  if (ctx.cursor + SIG_BLOCK_H > PAGE_BOTTOM - 6) {
    drawFooter(ctx);
    doc.addPage();
    ctx.pageNumber += 1;
    ctx.cursor = drawContinuationHeader(ctx);
  } else {
    ctx.cursor += 4;
  }

  drawSectionHeader(ctx, 'Signatures');

  const sigTopY = ctx.cursor + 4;
  const sigLineY = sigTopY + 18;

  // Left — Handla side
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(doc, [90, 90, 90]);
  doc.text('On behalf of HANDLA', PAGE.margin, sigTopY);

  if (contract.status === 'SIGNED') {
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(13);
    setText(doc, BLACK);
    doc.text('Handla', PAGE.margin + 2, sigLineY - 1.5);
  }

  setDraw(doc, BLACK);
  doc.setLineWidth(0.4);
  doc.line(PAGE.margin, sigLineY, PAGE.margin + 75, sigLineY);

  setText(doc, BLACK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(issuerName ?? 'Handla', PAGE.margin, sigLineY + 4);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  setText(doc, [90, 90, 90]);
  doc.text('Authorized representative', PAGE.margin, sigLineY + 7.5);
  if (contract.signedAt && contract.status === 'SIGNED') {
    doc.text(`Date: ${formatDate(contract.signedAt)}`, PAGE.margin, sigLineY + 10.8);
  }

  // Right — Client side
  const rSigX = PAGE.margin + COL_W + COL_GAP;
  setText(doc, [90, 90, 90]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Client acceptance', rSigX, sigTopY);

  if (contract.status === 'SIGNED') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setText(doc, BLACK);
    doc.text('SIGNED', rSigX + 2, sigLineY - 1.5);
  } else if (contract.status === 'REJECTED') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setText(doc, BLACK);
    doc.text('REJECTED', rSigX + 2, sigLineY - 1.5);
  }

  setDraw(doc, BLACK);
  doc.setLineWidth(0.4);
  doc.line(rSigX, sigLineY, rSigX + 75, sigLineY);

  setText(doc, BLACK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(clientName ?? clientCompany, rSigX, sigLineY + 4);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  setText(doc, [90, 90, 90]);
  doc.text(clientCompany !== clientName ? clientCompany : 'Client', rSigX, sigLineY + 7.5);
  if (contract.signedAt && contract.status === 'SIGNED') {
    doc.text(`Date: ${formatDate(contract.signedAt)}`, rSigX, sigLineY + 10.8);
  }

  ctx.cursor = sigLineY + 14;

  // Final footer
  drawFooter(ctx);

  // ── 6) Download ──────────────────────────────────────────────────────────
  const safeTitle =
    contract.title.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) ||
    'contract';
  const filename = `Contract_${safeTitle}_${contract.id.slice(0, 8)}.pdf`;
  doc.save(filename);
  return filename;
}

// ─── Structured-details renderer ─────────────────────────────────────────────
//
// Walks the ContractDetails payload section by section, emitting:
//   - section header
//   - key/value list, prose block, bullet list, or table — whichever fits the data
//
// Sections that have no data are skipped entirely so the document stays
// dense rather than padded with empty headings.

function renderStructuredDetails(ctx: DrawContext, d: ContractDetails) {
  // 4.1) Contract information
  {
    const rows: Array<[string, string]> = [];
    if (d.contractNumber) rows.push(['Contract Number', d.contractNumber]);
    if (d.contractType)   rows.push(['Contract Type',   CONTRACT_TYPE_LABEL[d.contractType] ?? d.contractType]);
    if (d.projectName)    rows.push(['Project Name',    d.projectName]);
    if (rows.length > 0) {
      drawSectionHeader(ctx, 'Contract Information');
      drawKvRows(ctx, rows);
    }
  }

  // 4.2) Project details
  {
    const hasContent =
      (d.projectDescription && d.projectDescription.trim()) ||
      (d.scopeOfWork        && d.scopeOfWork.trim()) ||
      (d.deliverables       && d.deliverables.length > 0) ||
      (d.excludedServices   && d.excludedServices.length > 0);
    if (hasContent) {
      drawSectionHeader(ctx, 'Project Details');
      if (d.projectDescription) drawProseBlock(ctx, 'Description',     d.projectDescription);
      if (d.scopeOfWork)        drawProseBlock(ctx, 'Scope of work',   d.scopeOfWork);
      if (d.deliverables?.length)      drawBulletList(ctx, 'Deliverables',      d.deliverables);
      if (d.excludedServices?.length)  drawBulletList(ctx, 'Excluded services', d.excludedServices);
    }
  }

  // 4.3) Timeline
  {
    const rows: Array<[string, string]> = [];
    if (d.startDate)         rows.push(['Start date',         d.startDate]);
    if (d.endDate)           rows.push(['End date',           d.endDate]);
    if (d.estimatedDuration) rows.push(['Estimated duration', d.estimatedDuration]);
    if (rows.length > 0) {
      drawSectionHeader(ctx, 'Timeline');
      drawKvRows(ctx, rows);
    }
  }

  // 4.4) Financial details
  {
    const rows: Array<[string, string]> = [];
    if (d.currency)               rows.push(['Currency',               d.currency]);
    if (d.totalValue !== undefined && d.totalValue !== null) {
      rows.push(['Total contract value', formatCurrency(d.totalValue, d.currency)]);
    }
    if (d.latePaymentPenalty)     rows.push(['Late payment penalty',   d.latePaymentPenalty]);
    if (rows.length > 0) {
      drawSectionHeader(ctx, 'Financial Details');
      drawKvRows(ctx, rows);
    }
  }

  // 4.5) Payment schedule — proper table (autoTable handles its own pagination)
  if (d.paymentMilestones && d.paymentMilestones.length > 0) {
    drawSectionHeader(ctx, 'Payment Schedule');
    drawMilestonesTable(ctx, d.paymentMilestones, d.currency);
  }

  // 4.6) Revisions
  {
    const rows: Array<[string, string]> = [];
    if (d.freeRevisions !== undefined && d.freeRevisions !== null) {
      rows.push(['Free revisions', String(d.freeRevisions)]);
    }
    if (d.additionalRevisionCost !== undefined && d.additionalRevisionCost !== null) {
      rows.push(['Additional revision cost', formatCurrency(d.additionalRevisionCost, d.currency)]);
    }
    if (rows.length > 0) {
      drawSectionHeader(ctx, 'Revisions');
      drawKvRows(ctx, rows);
    }
  }

  // 4.7) Warranty & Support
  {
    const rows: Array<[string, string]> = [];
    if (d.warrantyPeriod) rows.push(['Warranty period', d.warrantyPeriod]);
    if (d.supportPeriod)  rows.push(['Support period',  d.supportPeriod]);
    if (rows.length > 0) {
      drawSectionHeader(ctx, 'Warranty & Support');
      drawKvRows(ctx, rows);
    }
  }

  // 4.8) Intellectual property
  {
    if (d.ownershipType) {
      drawSectionHeader(ctx, 'Intellectual Property');
      drawKvRows(ctx, [['Ownership', OWNERSHIP_LABEL[d.ownershipType] ?? d.ownershipType]]);
    }
  }

  // 4.9) Confidentiality
  {
    const v = yn(d.ndaIncluded);
    if (v !== null) {
      drawSectionHeader(ctx, 'Confidentiality');
      drawKvRows(ctx, [['NDA included', v]]);
    }
  }

  // 4.10) Hosting & Deployment
  {
    const rows: Array<[string, string]> = [];
    const a = yn(d.hostingIncluded);    if (a !== null) rows.push(['Hosting included',    a]);
    const b = yn(d.domainIncluded);     if (b !== null) rows.push(['Domain included',     b]);
    const c = yn(d.sslIncluded);        if (c !== null) rows.push(['SSL included',        c]);
    const e = yn(d.deploymentIncluded); if (e !== null) rows.push(['Deployment included', e]);
    if (rows.length > 0) {
      drawSectionHeader(ctx, 'Hosting & Deployment');
      drawKvRows(ctx, rows);
    }
  }

  // 4.11) Termination
  if (d.terminationTerms && d.terminationTerms.trim()) {
    drawSectionHeader(ctx, 'Termination Clause');
    drawProseBlock(ctx, '', d.terminationTerms);
  }

  // 4.12) Acceptance
  if (d.acceptancePeriodDays !== undefined && d.acceptancePeriodDays !== null) {
    drawSectionHeader(ctx, 'Acceptance');
    drawKvRows(ctx, [['Acceptance period (days)', String(d.acceptancePeriodDays)]]);
  }

  // 4.13) Terms & conditions (long prose block — usually the bulk of the doc)
  if (d.termsAndConditions && d.termsAndConditions.trim()) {
    drawSectionHeader(ctx, 'Terms & Conditions');
    drawProseBlock(ctx, '', d.termsAndConditions);
  }
}

// ─── Payment-milestones table (handles its own pagination via autoTable) ─────

function drawMilestonesTable(
  ctx: DrawContext,
  milestones: PaymentMilestone[],
  currency: string | undefined,
) {
  const { doc } = ctx;
  ensureSpace(ctx, 18);

  const head = [['Milestone', 'Due', '%', 'Amount']];
  const body = milestones.map((m) => [
    m.name || '—',
    m.dueDate ?? '—',
    m.percentage !== undefined && m.percentage !== null ? `${m.percentage}%` : '—',
    m.amount !== undefined && m.amount !== null ? formatCurrency(m.amount, currency) : '—',
  ]);

  // autoTable creates its own new pages when content overflows. On those
  // continuation pages we need to:
  //   1) leave room for the lightweight continuation header at the top
  //      (margin.top), so the repeated table-header doesn't crash into it,
  //   2) reserve space for our footer at the bottom (margin.bottom),
  //   3) draw the continuation header & footer chrome ourselves via the
  //      didDrawPage hook.
  // We start tracking pages from the page autoTable starts on, which is
  // ctx.pageNumber at this point.
  const tableStartPage = ctx.pageNumber;
  // First page: table starts wherever the cursor is, so margin.top is fine
  // as a relaxed default. On continuation pages autoTable uses margin.top
  // as its starting Y — we set it just past the continuation header.
  const CONTINUATION_TOP_Y = PAGE.margin + 16;

  autoTable(doc, {
    startY: ctx.cursor,
    head,
    body,
    margin: {
      left:   PAGE.margin,
      right:  PAGE.margin,
      bottom: FOOTER_H + 6,
      top:    CONTINUATION_TOP_Y,
    },
    theme: 'plain',
    styles: {
      font:        'helvetica',
      fontSize:    9,
      textColor:   BLACK,
      lineColor:   BLACK,
      lineWidth:   0.15,
      cellPadding: { top: 2.4, bottom: 2.4, left: 2.5, right: 2.5 },
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
      1: { cellWidth: 26, halign: 'left'                       },
      2: { cellWidth: 16, halign: 'right'                      },
      3: { cellWidth: 32, halign: 'right', fontStyle: 'bold'   },
    },
    didDrawPage: (data) => {
      // Only paint the continuation chrome on pages autoTable itself spawned
      // (i.e. pages after the one the table started on). The first page's
      // chrome was already drawn by the outer renderer.
      if (data.pageNumber > tableStartPage) {
        ctx.pageNumber = data.pageNumber;
        drawContinuationHeader(ctx);
        drawFooter(ctx);
      }
    },
  });

  const lastY = (doc as any).lastAutoTable?.finalY ?? ctx.cursor + 20;
  ctx.cursor = lastY + 4;
}
