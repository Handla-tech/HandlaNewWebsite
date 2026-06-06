/**
 * Contract PDF Generator — Handla
 *
 * Pure black-and-white, print-friendly A4 layout. Mirrors the design language
 * of the invoice PDF so both documents look like they belong to the same brand
 * when printed.
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │  Handla details      [QR code]       CONTRACT meta            │
 *   │   logo + contact     scan → opens    title / dates / status   │
 *   │                      public viewer                            │
 *   │ ═════════════════════════════════════════════════════════════  │
 *   │  Parties:  ISSUED BY            CONTRACTED WITH               │
 *   │ ─────────────────────────────────────────────────────────────  │
 *   │  Contract body (paginated automatically)                       │
 *   │ ─────────────────────────────────────────────────────────────  │
 *   │  Signatures (Handla left · Client right)                       │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Design rules:
 *   - 100 % black text on white background — no fills, no greys.
 *   - Outlined status pill — photocopy-friendly.
 *   - Body text auto-paginates with a per-page header showing the
 *     contract number and "Page N / M".
 */

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Contract } from '@/types';

// ─── Colour tokens ───────────────────────────────────────────────────────────

const BLACK: [number, number, number] = [0, 0, 0];

// ─── Layout constants (mm) ───────────────────────────────────────────────────

const PAGE = {
  width:   210,
  height:  297,
  margin:  16,
};
const CONTENT_W = PAGE.width - PAGE.margin * 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setText(doc: jsPDF, c: [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2]);
}
function setDraw(doc: jsPDF, c: [number, number, number]) {
  doc.setDrawColor(c[0], c[1], c[2]);
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

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ContractPdfOptions {
  /**
   * Base URL the QR code should point at. Final target is
   * `${baseUrl}/contract/public/${contract.id}`.
   */
  baseUrl?: string;

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

  // ── Resolve QR target ────────────────────────────────────────────────────
  const baseUrl =
    options.baseUrl ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://handla.com');
  const qrTarget = `${baseUrl.replace(/\/$/, '')}/contract/public/${contract.id}`;

  const qrDataUrl = await QRCode.toDataURL(qrTarget, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 512,
    color: { dark: '#000000', light: '#ffffff' },
  });

  // ── 1) Top section (header) ──────────────────────────────────────────────
  const topY = PAGE.margin;
  const topH = 42;

  // 1a) Left column — Handla details
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

  // 1b) Middle column — QR code
  const qrSize = 30;
  const qrX    = PAGE.margin + (CONTENT_W - qrSize) / 2;
  const qrY    = topY + 4;

  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  setDraw(doc, BLACK);
  doc.setLineWidth(0.2);
  doc.rect(qrX - 0.6, qrY - 0.6, qrSize + 1.2, qrSize + 1.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Scan to view contract online', qrX + qrSize / 2, qrY + qrSize + 4.5, { align: 'center' });

  // 1c) Right column — Contract meta
  const rightX = PAGE.margin + CONTENT_W;
  let rightY   = topY + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('CONTRACT', rightX, rightY, { align: 'right' });
  rightY += 7;

  // Short contract ID — first 8 chars of UUID — serves as a printable reference.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(`Ref: ${contract.id.slice(0, 8).toUpperCase()}`, rightX, rightY, { align: 'right' });
  rightY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const drawMeta = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, rightX - 32, rightY, { align: 'left' });
    doc.setFont('helvetica', 'bold');
    doc.text(value, rightX, rightY, { align: 'right' });
    rightY += 4.2;
  };

  drawMeta('Created', formatDate(contract.createdAt));
  if (contract.sentAt)   drawMeta('Sent',   formatDate(contract.sentAt));
  if (contract.signedAt) drawMeta('Signed', formatDate(contract.signedAt));

  // Status pill — outlined, no fill
  const pillW = 28;
  const pillH = 6.5;
  const pillX = rightX - pillW;
  const pillY = rightY + 1;

  setDraw(doc, BLACK);
  doc.setLineWidth(0.4);
  doc.rect(pillX, pillY, pillW, pillH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(contract.status, pillX + pillW / 2, pillY + 4.4, { align: 'center' });

  // Thick black rule below the top section
  setDraw(doc, BLACK);
  doc.setLineWidth(0.6);
  doc.line(PAGE.margin, topY + topH, PAGE.width - PAGE.margin, topY + topH);

  // ── 2) Title row ─────────────────────────────────────────────────────────
  let cursor = topY + topH + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const titleLines = fitText(doc, contract.title, CONTENT_W);
  titleLines.slice(0, 2).forEach((l) => {
    doc.text(l, PAGE.margin, cursor);
    cursor += 6;
  });
  cursor += 2;

  // ── 3) Parties row (Issued by | Contracted with) ─────────────────────────
  const colW = (CONTENT_W - 10) / 2;

  // Thin divider
  setDraw(doc, BLACK);
  doc.setLineWidth(0.2);
  doc.line(PAGE.margin, cursor, PAGE.width - PAGE.margin, cursor);
  cursor += 5;

  // 3a) Issued by (left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('ISSUED BY', PAGE.margin, cursor);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Handla', PAGE.margin, cursor + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const issuerLines: string[] = [];
  const issuerName = options.issuerName ?? contract.owner?.name;
  if (issuerName) issuerLines.push(`Representative: ${issuerName}`);
  if (options.issuerEmail)   issuerLines.push(options.issuerEmail);
  else if (contract.owner?.email) issuerLines.push(contract.owner.email);
  if (options.issuerPhone)   issuerLines.push(options.issuerPhone);
  if (options.issuerAddress) issuerLines.push(options.issuerAddress);

  let issuerCursor = cursor + 10;
  issuerLines.forEach((line) => {
    fitText(doc, line, colW - 4).forEach((l) => {
      doc.text(l, PAGE.margin, issuerCursor);
      issuerCursor += 3.8;
    });
  });

  // 3b) Contracted with (right)
  const custX = PAGE.margin + colW + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CONTRACTED WITH', custX, cursor);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const clientCompany = contract.client?.company ?? contract.client?.user?.name ?? 'Client';
  doc.text(clientCompany, custX, cursor + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const customerLines: string[] = [];
  if (contract.client?.company && contract.client?.user?.name) {
    customerLines.push(`Attn: ${contract.client.user.name}`);
  }
  if (contract.client?.user?.email) customerLines.push(contract.client.user.email);
  if ((contract.client?.user as any)?.phoneNumber) {
    customerLines.push(String((contract.client?.user as any).phoneNumber));
  }
  if ((contract.client?.user as any)?.location) {
    customerLines.push(String((contract.client?.user as any).location));
  }
  customerLines.push(`Client ID: ${contract.clientId.slice(0, 8)}`);

  let custCursor = cursor + 10;
  customerLines.forEach((line) => {
    fitText(doc, line, colW - 4).forEach((l) => {
      doc.text(l, custX, custCursor);
      custCursor += 3.8;
    });
  });

  // Advance cursor past the parties block
  cursor = Math.max(issuerCursor, custCursor) + 4;

  // Thin divider before the body
  setDraw(doc, BLACK);
  doc.setLineWidth(0.2);
  doc.line(PAGE.margin, cursor, PAGE.width - PAGE.margin, cursor);
  cursor += 6;

  // ── 4) Contract body — auto-paginated ────────────────────────────────────
  //
  // We render the stored `body` as plain pre-wrapped text. The backend stores
  // either the author's prose or the auto-rendered output of the structured
  // contract form. Either way the text is already human-readable, so we just
  // word-wrap and paginate.
  //
  // Heading "TERMS & CONDITIONS" anchors the section before the prose.

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setText(doc, BLACK);
  doc.text('TERMS & CONDITIONS', PAGE.margin, cursor);
  cursor += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const bodyLines = fitText(doc, contract.body || '(No content)', CONTENT_W);

  // Reserve space at the bottom of the LAST page for the signatures block.
  // On intermediate pages the bottom limit is just the footer.
  const SIGNATURE_RESERVE = 60;   // mm — reserve room on the page where the body ends
  const FOOTER_RESERVE    = 18;   // mm — page footer line + thank-you text
  const LINE_HEIGHT       = 4.2;

  /**
   * Returns true if the next line would overflow the page (taking the
   * reserve for signatures and footer into account on the current page).
   */
  const bodyBottom = (lastPage: boolean) =>
    PAGE.height - (lastPage ? SIGNATURE_RESERVE : FOOTER_RESERVE);

  // Helper: draw page footer (rule + thank-you + QR URL) on every page.
  const drawPageFooter = () => {
    setDraw(doc, BLACK);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, PAGE.height - 14, PAGE.width - PAGE.margin, PAGE.height - 14);
    setText(doc, BLACK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Handla contract — confidential', PAGE.margin, PAGE.height - 9);
    doc.text(qrTarget, PAGE.width - PAGE.margin, PAGE.height - 9, { align: 'right' });
  };

  // Helper: lightweight page header on continuation pages (just the contract
  // reference and the title) so the document stays self-identifying.
  const drawContinuationHeader = () => {
    setText(doc, BLACK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Contract · ${contract.id.slice(0, 8).toUpperCase()}`, PAGE.margin, PAGE.margin + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const continuationTitle = fitText(doc, contract.title, CONTENT_W - 30)[0] ?? '';
    doc.text(continuationTitle, PAGE.margin, PAGE.margin + 8);
    setDraw(doc, BLACK);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, PAGE.margin + 11, PAGE.width - PAGE.margin, PAGE.margin + 11);
  };

  // Walk the lines, paginating when needed. We track whether we've drawn ANY
  // body line on the current page so we don't emit a blank continuation page.
  let lineIndex      = 0;
  let lastPageRender = false;

  while (lineIndex < bodyLines.length) {
    const linesRemainingOnPage = bodyLines.length - lineIndex;
    // Try the optimistic assumption: this could be the last page. If we can
    // fit all remaining lines within bodyBottom(true) we render with the
    // signature reserve.
    const bottomIfLast = bodyBottom(true);
    const linesThatFitIfLast = Math.floor((bottomIfLast - cursor) / LINE_HEIGHT);

    if (linesRemainingOnPage <= linesThatFitIfLast) {
      // Render the last chunk on this page; mark as last so we draw signatures
      for (let k = 0; k < linesRemainingOnPage; k++) {
        doc.text(bodyLines[lineIndex++], PAGE.margin, cursor);
        cursor += LINE_HEIGHT;
      }
      lastPageRender = true;
      break;
    }

    // Otherwise, fill the page up to the footer reserve, then add a new page
    const bottomIfNotLast = bodyBottom(false);
    const linesThatFitNotLast = Math.max(1, Math.floor((bottomIfNotLast - cursor) / LINE_HEIGHT));
    const toRender = Math.min(linesRemainingOnPage, linesThatFitNotLast);

    for (let k = 0; k < toRender; k++) {
      doc.text(bodyLines[lineIndex++], PAGE.margin, cursor);
      cursor += LINE_HEIGHT;
    }

    // Page complete — draw footer and add a new page
    drawPageFooter();
    doc.addPage();
    drawContinuationHeader();
    cursor = PAGE.margin + 16;
  }

  // ── 5) Signatures block (last page only) ─────────────────────────────────
  //
  // Two signature areas: HANDLA (left) and CLIENT (right). If the contract is
  // already SIGNED we stamp a "SIGNED" marker on the client side and "Handla"
  // on the issuer side.
  if (!lastPageRender) {
    // Defensive: if the loop above didn't mark a final page (unlikely), make
    // sure we still get one. Add a page if there isn't enough room.
    if (cursor > PAGE.height - SIGNATURE_RESERVE) {
      drawPageFooter();
      doc.addPage();
      drawContinuationHeader();
      cursor = PAGE.margin + 16;
    }
  }

  // Anchor signatures near the bottom of the current page
  const sigBlockY = PAGE.height - SIGNATURE_RESERVE + 6;

  // Section heading
  setText(doc, BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SIGNATURES', PAGE.margin, sigBlockY);

  setDraw(doc, BLACK);
  doc.setLineWidth(0.2);
  doc.line(PAGE.margin, sigBlockY + 2.5, PAGE.width - PAGE.margin, sigBlockY + 2.5);

  // Left — Handla signature
  const sigLineY = sigBlockY + 25;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('On behalf of Handla', PAGE.margin, sigBlockY + 9);
  if (contract.status === 'SIGNED') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Handla', PAGE.margin + 2, sigLineY - 2);
  }
  setDraw(doc, BLACK);
  doc.setLineWidth(0.4);
  doc.line(PAGE.margin, sigLineY, PAGE.margin + 70, sigLineY);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.text('Authorized representative', PAGE.margin, sigLineY + 4);
  if (contract.signedAt) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Date: ${formatDate(contract.signedAt)}`, PAGE.margin, sigLineY + 8);
  }

  // Right — Client signature
  const rSigX = PAGE.margin + colW + 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Client acceptance', rSigX, sigBlockY + 9);
  if (contract.status === 'SIGNED') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('SIGNED', rSigX + 2, sigLineY - 2);
  } else if (contract.status === 'REJECTED') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('REJECTED', rSigX + 2, sigLineY - 2);
  }
  setDraw(doc, BLACK);
  doc.setLineWidth(0.4);
  doc.line(rSigX, sigLineY, rSigX + 70, sigLineY);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.text(
    contract.client?.user?.name ?? contract.client?.company ?? 'Client',
    rSigX,
    sigLineY + 4,
  );
  if (contract.signedAt && contract.status === 'SIGNED') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Date: ${formatDate(contract.signedAt)}`, rSigX, sigLineY + 8);
  }

  // Final page footer
  drawPageFooter();

  // ── 6) Trigger download ──────────────────────────────────────────────────
  const safeTitle =
    contract.title.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) ||
    'contract';
  const filename = `Contract_${safeTitle}_${contract.id.slice(0, 8)}.pdf`;
  doc.save(filename);
  return filename;
}
