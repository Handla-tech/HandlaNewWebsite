/**
 * Render a human-readable plain-text contract body from a ContractDetailsDto.
 *
 * Used by ContractsService when a comprehensive `details` payload is provided
 * on create / update — so the existing `body` column (and the downstream
 * HTML PDF template that uses {{body}}) keep working without changes.
 *
 * The output is intentionally plain-text with section dividers — the
 * contract.hbs template renders it inside <div class="body"> with
 * `white-space: pre-wrap` so the formatting survives.
 */
import {
  ContractDetailsDto,
  ContractType,
  OwnershipType,
  PaymentMilestoneDto,
} from './dto/contract-details.dto';

// Plain ASCII divider — Unicode box-drawing characters (e.g. U+2550 '═')
// render as mojibake (`%P%P%P…`) in jsPDF's WinAnsi-encoded Helvetica.
// Sticking to ASCII keeps the rendered output legible in every consumer
// (HTML viewer, jsPDF, plain-text email previews).
const DIVIDER = '---------------------------------------------';

function section(title: string, lines: (string | null | undefined | false)[]): string {
  const body = lines.filter((l): l is string => !!l && l.trim().length > 0).join('\n');
  if (!body) return '';
  return `\n${DIVIDER}\n${title.toUpperCase()}\n${DIVIDER}\n${body}\n`;
}

function kv(label: string, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return `${label}: ${value}`;
}

function yesNo(value: boolean | undefined): string | null {
  // Return null for "not set" so kv() skips the line — otherwise every
  // unset boolean flag would be reported as "No" and pollute the output.
  if (value === undefined || value === null) return null;
  return value ? 'Yes' : 'No';
}

function formatCurrency(amount: number | undefined, currency: string | undefined): string {
  if (amount === undefined || amount === null) return '';
  const cur = currency || 'USD';
  return `${cur} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatType(t: ContractType | undefined): string {
  if (!t) return '';
  return t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatOwnership(o: OwnershipType | undefined): string {
  switch (o) {
    case OwnershipType.CLIENT_OWNS_EVERYTHING:            return 'Client Owns Everything';
    case OwnershipType.OWNERSHIP_TRANSFERS_AFTER_PAYMENT: return 'Ownership Transfers After Full Payment';
    case OwnershipType.SHARED_OWNERSHIP:                  return 'Shared Ownership';
    default: return '';
  }
}

function formatMilestone(m: PaymentMilestoneDto, currency?: string): string {
  const parts: string[] = [`• ${m.name || 'Milestone'}`];
  if (m.percentage !== undefined) parts.push(`${m.percentage}%`);
  if (m.amount     !== undefined) parts.push(formatCurrency(m.amount, currency));
  if (m.dueDate)                  parts.push(`due ${m.dueDate}`);
  return parts.join(' — ');
}

function formatList(items: string[] | undefined): string {
  if (!items || items.length === 0) return '';
  return items
    .map((i) => i.trim())
    .filter((i) => i.length > 0)
    .map((i) => `• ${i}`)
    .join('\n');
}

export function renderContractBody(details: ContractDetailsDto): string {
  const parts: string[] = [];

  parts.push(section('Contract Information', [
    kv('Contract Number', details.contractNumber),
    kv('Contract Type',   formatType(details.contractType)),
    kv('Project Name',    details.projectName),
  ]));

  parts.push(section('Client Information', [
    kv('Client Name',  details.clientName),
    kv('Company',      details.clientCompany),
    kv('Email',        details.clientEmail),
    kv('Phone',        details.clientPhone),
    kv('Address',      details.clientAddress),
  ]));

  parts.push(section('Project Details', [
    details.projectDescription ? `Description:\n${details.projectDescription}` : null,
    details.scopeOfWork ? `\nScope of Work:\n${details.scopeOfWork}` : null,
    details.deliverables?.length ? `\nDeliverables:\n${formatList(details.deliverables)}` : null,
    details.excludedServices?.length ? `\nExcluded Services:\n${formatList(details.excludedServices)}` : null,
  ]));

  parts.push(section('Timeline', [
    kv('Start Date',         details.startDate),
    kv('End Date',           details.endDate),
    kv('Estimated Duration', details.estimatedDuration),
  ]));

  parts.push(section('Financial Details', [
    kv('Currency',            details.currency),
    kv('Total Contract Value', formatCurrency(details.totalValue, details.currency)),
  ]));

  if (details.paymentMilestones?.length) {
    parts.push(section('Payment Schedule', [
      details.paymentMilestones.map((m) => formatMilestone(m, details.currency)).join('\n'),
    ]));
  }

  parts.push(section('Revision Policy', [
    kv('Free Revisions',          details.freeRevisions),
    kv('Additional Revision Cost', formatCurrency(details.additionalRevisionCost, details.currency)),
  ]));

  parts.push(section('Warranty & Support', [
    kv('Warranty Period', details.warrantyPeriod),
    kv('Support Period',  details.supportPeriod),
  ]));

  parts.push(section('Intellectual Property', [
    kv('Ownership', formatOwnership(details.ownershipType)),
  ]));

  parts.push(section('Confidentiality', [
    kv('NDA Included', yesNo(details.ndaIncluded)),
  ]));

  parts.push(section('Hosting & Deployment', [
    kv('Hosting Included',    yesNo(details.hostingIncluded)),
    kv('Domain Included',     yesNo(details.domainIncluded)),
    kv('SSL Included',        yesNo(details.sslIncluded)),
    kv('Deployment Included', yesNo(details.deploymentIncluded)),
  ]));

  parts.push(section('Late Payment Terms', [
    kv('Penalty', details.latePaymentPenalty),
  ]));

  if (details.terminationTerms) {
    parts.push(section('Termination Clause', [details.terminationTerms]));
  }

  parts.push(section('Acceptance Terms', [
    kv('Acceptance Period (Days)', details.acceptancePeriodDays),
  ]));

  if (details.termsAndConditions) {
    parts.push(section('Terms & Conditions', [details.termsAndConditions]));
  }

  return parts.filter((p) => p.length > 0).join('\n').trim();
}
