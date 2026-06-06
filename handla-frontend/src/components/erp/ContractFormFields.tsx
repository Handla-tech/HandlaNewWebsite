'use client';

/**
 * ContractFormFields — Comprehensive contract form (18 sections).
 *
 * Reusable in Create/Edit modals. Uses react-hook-form (Controller for
 * the dynamic milestones field array) and emits `details: ContractDetails`
 * + top-level `title` + `clientId`.
 *
 * All fields are OPTIONAL except title (and clientId in create mode).
 * Empty strings are pruned in the parent before submitting to the API.
 */

import { useFieldArray, Control, UseFormRegister, FieldErrors, Controller } from 'react-hook-form';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ContractType, OwnershipType, Client } from '@/types';

// ─── Local form-only types ───────────────────────────────────────────────────

export interface ContractFormValues {
  title:    string;
  clientId: string;
  details: {
    // contract info
    contractNumber?: string;
    contractType?:   ContractType | '';
    projectName?:    string;
    // client info
    clientName?:     string;
    clientCompany?:  string;
    clientEmail?:    string;
    clientPhone?:    string;
    clientAddress?:  string;
    // project details
    projectDescription?: string;
    scopeOfWork?:        string;
    deliverablesText?:   string;     // textarea, one per line
    excludedServicesText?: string;   // textarea, one per line
    // timeline
    startDate?:          string;
    endDate?:            string;
    estimatedDuration?:  string;
    // financial
    currency?:           string;
    totalValue?:         number | '';
    // payment milestones (Controller field-array)
    paymentMilestones?:  {
      name:        string;
      percentage?: number | '';
      amount?:     number | '';
      dueDate?:    string;
    }[];
    // revisions
    freeRevisions?:           number | '';
    additionalRevisionCost?:  number | '';
    // warranty
    warrantyPeriod?:     string;
    supportPeriod?:      string;
    // IP
    ownershipType?:      OwnershipType | '';
    // confidentiality
    ndaIncluded?:        boolean;
    // hosting
    hostingIncluded?:    boolean;
    domainIncluded?:     boolean;
    sslIncluded?:        boolean;
    deploymentIncluded?: boolean;
    // late payment
    latePaymentPenalty?: string;
    // termination
    terminationTerms?:   string;
    // acceptance
    acceptancePeriodDays?: number | '';
    // general
    termsAndConditions?: string;
  };
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const inputCls = (hasError?: boolean) =>
  cn(
    'w-full rounded-xl border bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:bg-white/[0.06] focus:border-[#fbbf24]/50 min-h-[44px]',
    hasError ? 'border-red-400/50' : 'border-white/10',
  );

// ─── Field wrapper ───────────────────────────────────────────────────────────

function Field({
  label, hint, error, children, className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-white/30">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}

// ─── Collapsible section ─────────────────────────────────────────────────────

function Section({
  title, description, children, defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors min-h-[52px]"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          {description && <p className="text-[11px] text-white/40 mt-0.5">{description}</p>}
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/[0.05]">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

function Toggle({
  label, checked, onChange, description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-white/85">{label}</p>
        {description && <p className="text-[11px] text-white/35 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-10 flex-shrink-0 rounded-full transition-colors',
          checked ? 'bg-[#fbbf24]' : 'bg-white/10',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform translate-y-0.5',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

// ─── Payment Milestones (field array) ────────────────────────────────────────

function PaymentMilestonesField({
  control, register,
}: {
  control: Control<ContractFormValues>;
  register: UseFormRegister<ContractFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'details.paymentMilestones',
  });

  return (
    <div className="space-y-2">
      {fields.length === 0 && (
        <p className="text-[11px] text-white/30 italic">No milestones added yet.</p>
      )}
      {fields.map((field, idx) => (
        <div
          key={field.id}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
              Milestone {idx + 1}
            </p>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              aria-label={`Remove milestone ${idx + 1}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Name">
              <input
                {...register(`details.paymentMilestones.${idx}.name` as const)}
                placeholder="e.g. Deposit"
                className={inputCls()}
              />
            </Field>
            <Field label="Due Date">
              <input
                type="date"
                {...register(`details.paymentMilestones.${idx}.dueDate` as const)}
                className={inputCls()}
              />
            </Field>
            <Field label="Percentage" hint="0–100 (optional)">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register(`details.paymentMilestones.${idx}.percentage` as const, {
                  setValueAs: v => (v === '' || v === null ? '' : Number(v)),
                })}
                placeholder="50"
                className={inputCls()}
              />
            </Field>
            <Field label="Amount" hint="Absolute value (optional)">
              <input
                type="number"
                step="0.01"
                min="0"
                {...register(`details.paymentMilestones.${idx}.amount` as const, {
                  setValueAs: v => (v === '' || v === null ? '' : Number(v)),
                })}
                placeholder="5000"
                className={inputCls()}
              />
            </Field>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({ name: '', percentage: '', amount: '', dueDate: '' })}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/15 text-white/50 hover:text-white hover:border-white/30 transition-colors text-xs font-medium min-h-[40px]"
      >
        <Plus className="w-3.5 h-3.5" /> Add Milestone
      </button>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface ContractFormFieldsProps {
  register:   UseFormRegister<ContractFormValues>;
  control:    Control<ContractFormValues>;
  errors:     FieldErrors<ContractFormValues>;
  /** Client list — only used in create mode. In edit mode, pass undefined. */
  clients?:   Client[];
  clientsLoading?: boolean;
  /** If true, the Client select is hidden (edit mode). */
  hideClientSelect?: boolean;
  /** Status badge for read-only display in edit mode. */
  statusBadge?: React.ReactNode;
}

export function ContractFormFields({
  register, control, errors, clients = [], clientsLoading = false,
  hideClientSelect = false, statusBadge,
}: ContractFormFieldsProps) {
  return (
    <div className="space-y-3">
      {/* ── REQUIRED HEADER ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#fbbf24]/20 bg-[#fbbf24]/[0.04] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#fbbf24]">
            Required
          </p>
          {statusBadge}
        </div>

        <Field label="Contract Title *" error={errors.title?.message}>
          <input
            {...register('title')}
            placeholder="e.g. Website Development Agreement"
            className={inputCls(!!errors.title)}
          />
        </Field>

        {!hideClientSelect && (
          <Field label="Client *" error={errors.clientId?.message}>
            <select
              {...register('clientId')}
              disabled={clientsLoading}
              className={cn(
                inputCls(!!errors.clientId),
                'bg-[#0f0f0f]',
                clientsLoading && 'opacity-60 cursor-wait',
              )}
            >
              <option value="">
                {clientsLoading
                  ? 'Loading clients…'
                  : clients.length === 0
                    ? 'No clients found'
                    : 'Select a client…'}
              </option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.user?.name ?? c.id}
                  {c.company ? ` (${c.company})` : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {/* ── 1. CONTRACT INFORMATION ────────────────────────────────────────── */}
      <Section
        title="Contract Information"
        description="Basic identifiers for this agreement"
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Contract Number">
            <input
              {...register('details.contractNumber')}
              placeholder="CN-2026-001"
              className={inputCls()}
            />
          </Field>
          <Field label="Contract Type">
            <select
              {...register('details.contractType')}
              className={cn(inputCls(), 'bg-[#0f0f0f]')}
            >
              <option value="">— Select —</option>
              <option value="FIXED_PRICE">Fixed Price</option>
              <option value="HOURLY">Hourly</option>
              <option value="RETAINER">Retainer</option>
              <option value="MILESTONE">Milestone</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="CONSULTATION">Consultation</option>
            </select>
          </Field>
          <Field label="Project Name" className="sm:col-span-2">
            <input
              {...register('details.projectName')}
              placeholder="e.g. Acme Marketing Website"
              className={inputCls()}
            />
          </Field>
        </div>
      </Section>

      {/* ── 2. CLIENT INFORMATION ──────────────────────────────────────────── */}
      <Section title="Client Information" description="Contact and address details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Client Name">
            <input {...register('details.clientName')} className={inputCls()} />
          </Field>
          <Field label="Company">
            <input {...register('details.clientCompany')} className={inputCls()} />
          </Field>
          <Field label="Email">
            <input
              type="email"
              {...register('details.clientEmail')}
              placeholder="contact@example.com"
              className={inputCls()}
            />
          </Field>
          <Field label="Phone">
            <input
              {...register('details.clientPhone')}
              placeholder="+1 555 123 4567"
              className={inputCls()}
            />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <textarea
              {...register('details.clientAddress')}
              rows={2}
              placeholder="Street, City, Country"
              className={cn(inputCls(), 'resize-y min-h-[60px] h-auto py-2')}
            />
          </Field>
        </div>
      </Section>

      {/* ── 3. PROJECT DETAILS ─────────────────────────────────────────────── */}
      <Section title="Project Details" description="Description, scope, deliverables, exclusions">
        <Field label="Project Description">
          <textarea
            {...register('details.projectDescription')}
            rows={3}
            placeholder="Brief overview of the project"
            className={cn(inputCls(), 'resize-y min-h-[80px] h-auto py-2')}
          />
        </Field>
        <Field label="Scope of Work">
          <textarea
            {...register('details.scopeOfWork')}
            rows={4}
            placeholder="Detailed scope, methodology, and approach"
            className={cn(inputCls(), 'resize-y min-h-[100px] h-auto py-2')}
          />
        </Field>
        <Field label="Deliverables" hint="One per line">
          <textarea
            {...register('details.deliverablesText')}
            rows={4}
            placeholder={'e.g.\nLanding page design\nResponsive HTML/CSS implementation\nCMS integration'}
            className={cn(inputCls(), 'resize-y min-h-[100px] h-auto py-2')}
          />
        </Field>
        <Field label="Excluded Services" hint="One per line">
          <textarea
            {...register('details.excludedServicesText')}
            rows={3}
            placeholder={'e.g.\nMarketing campaigns\nThird-party integrations'}
            className={cn(inputCls(), 'resize-y min-h-[80px] h-auto py-2')}
          />
        </Field>
      </Section>

      {/* ── 4. TIMELINE ────────────────────────────────────────────────────── */}
      <Section title="Timeline" description="Start, end, and estimated duration">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Start Date">
            <input type="date" {...register('details.startDate')} className={inputCls()} />
          </Field>
          <Field label="End Date">
            <input type="date" {...register('details.endDate')} className={inputCls()} />
          </Field>
          <Field label="Estimated Duration">
            <input
              {...register('details.estimatedDuration')}
              placeholder="e.g. 3 months"
              className={inputCls()}
            />
          </Field>
        </div>
      </Section>

      {/* ── 5. FINANCIAL DETAILS ───────────────────────────────────────────── */}
      <Section title="Financial Details" description="Currency and total contract value">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Currency">
            <input
              {...register('details.currency')}
              placeholder="USD"
              className={inputCls()}
            />
          </Field>
          <Field label="Total Value">
            <input
              type="number"
              step="0.01"
              min="0"
              {...register('details.totalValue', {
                setValueAs: v => (v === '' || v === null ? '' : Number(v)),
              })}
              placeholder="10000"
              className={inputCls()}
            />
          </Field>
        </div>
      </Section>

      {/* ── 6. PAYMENT SCHEDULE ────────────────────────────────────────────── */}
      <Section title="Payment Schedule" description="Milestones, percentages, amounts">
        <PaymentMilestonesField control={control} register={register} />
      </Section>

      {/* ── 7. REVISION POLICY ─────────────────────────────────────────────── */}
      <Section title="Revision Policy" description="Free revisions and additional cost">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Free Revisions">
            <input
              type="number"
              min="0"
              {...register('details.freeRevisions', {
                setValueAs: v => (v === '' || v === null ? '' : Number(v)),
              })}
              placeholder="2"
              className={inputCls()}
            />
          </Field>
          <Field label="Additional Revision Cost">
            <input
              type="number"
              step="0.01"
              min="0"
              {...register('details.additionalRevisionCost', {
                setValueAs: v => (v === '' || v === null ? '' : Number(v)),
              })}
              placeholder="250"
              className={inputCls()}
            />
          </Field>
        </div>
      </Section>

      {/* ── 8. WARRANTY & SUPPORT ──────────────────────────────────────────── */}
      <Section title="Warranty & Support">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Warranty Period">
            <input
              {...register('details.warrantyPeriod')}
              placeholder="e.g. 30 days"
              className={inputCls()}
            />
          </Field>
          <Field label="Support Period">
            <input
              {...register('details.supportPeriod')}
              placeholder="e.g. 90 days"
              className={inputCls()}
            />
          </Field>
        </div>
      </Section>

      {/* ── 9. INTELLECTUAL PROPERTY ───────────────────────────────────────── */}
      <Section title="Intellectual Property" description="Ownership of deliverables">
        <Field label="Ownership Type">
          <select
            {...register('details.ownershipType')}
            className={cn(inputCls(), 'bg-[#0f0f0f]')}
          >
            <option value="">— Select —</option>
            <option value="CLIENT_OWNS_EVERYTHING">Client Owns Everything</option>
            <option value="OWNERSHIP_TRANSFERS_AFTER_PAYMENT">
              Ownership Transfers After Final Payment
            </option>
            <option value="SHARED_OWNERSHIP">Shared Ownership</option>
          </select>
        </Field>
      </Section>

      {/* ── 10. CONFIDENTIALITY ────────────────────────────────────────────── */}
      <Section title="Confidentiality">
        <Controller
          name="details.ndaIncluded"
          control={control}
          render={({ field }) => (
            <Toggle
              label="Non-Disclosure Agreement (NDA)"
              description="Both parties agree to keep project information confidential"
              checked={!!field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Section>

      {/* ── 11. HOSTING & DEPLOYMENT ───────────────────────────────────────── */}
      <Section title="Hosting & Deployment" description="What's included in the package">
        <div className="space-y-2">
          {([
            ['hostingIncluded',    'Hosting Included'],
            ['domainIncluded',     'Domain Included'],
            ['sslIncluded',        'SSL Certificate Included'],
            ['deploymentIncluded', 'Deployment Included'],
          ] as const).map(([name, label]) => (
            <Controller
              key={name}
              name={`details.${name}` as const}
              control={control}
              render={({ field }) => (
                <Toggle
                  label={label}
                  checked={!!field.value}
                  onChange={field.onChange}
                />
              )}
            />
          ))}
        </div>
      </Section>

      {/* ── 12. LATE PAYMENT TERMS ─────────────────────────────────────────── */}
      <Section title="Late Payment Terms">
        <Field label="Late Payment Penalty">
          <input
            {...register('details.latePaymentPenalty')}
            placeholder="e.g. 1.5% per month"
            className={inputCls()}
          />
        </Field>
      </Section>

      {/* ── 13. TERMINATION ────────────────────────────────────────────────── */}
      <Section title="Termination Clause">
        <Field label="Termination Terms">
          <textarea
            {...register('details.terminationTerms')}
            rows={3}
            placeholder="Conditions under which either party may terminate"
            className={cn(inputCls(), 'resize-y min-h-[80px] h-auto py-2')}
          />
        </Field>
      </Section>

      {/* ── 14. ACCEPTANCE ─────────────────────────────────────────────────── */}
      <Section title="Acceptance Terms">
        <Field
          label="Acceptance Period (days)"
          hint="Time client has to formally accept deliverables"
        >
          <input
            type="number"
            min="0"
            {...register('details.acceptancePeriodDays', {
              setValueAs: v => (v === '' || v === null ? '' : Number(v)),
            })}
            placeholder="7"
            className={inputCls()}
          />
        </Field>
      </Section>

      {/* ── 15. GENERAL TERMS & CONDITIONS ─────────────────────────────────── */}
      <Section title="Terms & Conditions" description="General contractual terms">
        <Field label="Terms & Conditions">
          <textarea
            {...register('details.termsAndConditions')}
            rows={6}
            placeholder="Add any general terms, governing law, dispute resolution, etc."
            className={cn(inputCls(), 'resize-y min-h-[140px] h-auto py-2')}
          />
        </Field>
      </Section>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert ContractFormValues into the API payload, pruning empty strings,
 * empty arrays, undefined values, and converting the multi-line text areas
 * into string arrays.
 */
export function buildContractPayload(values: ContractFormValues): {
  title:    string;
  clientId?: string;
  details:  Record<string, unknown>;
} {
  const d = values.details ?? {};
  const out: Record<string, unknown> = {};

  const pushStr = (k: keyof typeof d) => {
    const v = d[k];
    if (typeof v === 'string' && v.trim() !== '') out[k] = v.trim();
  };
  const pushNum = (k: keyof typeof d) => {
    const v = d[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  };
  const pushBool = (k: keyof typeof d) => {
    const v = d[k];
    if (typeof v === 'boolean') out[k] = v;
  };

  // Strings
  ([
    'contractNumber', 'contractType', 'projectName',
    'clientName', 'clientCompany', 'clientEmail', 'clientPhone', 'clientAddress',
    'projectDescription', 'scopeOfWork',
    'startDate', 'endDate', 'estimatedDuration',
    'currency',
    'warrantyPeriod', 'supportPeriod',
    'ownershipType',
    'latePaymentPenalty', 'terminationTerms', 'termsAndConditions',
  ] as const).forEach(k => pushStr(k));

  // Numbers
  ([
    'totalValue', 'freeRevisions', 'additionalRevisionCost', 'acceptancePeriodDays',
  ] as const).forEach(k => pushNum(k));

  // Booleans
  ([
    'ndaIncluded', 'hostingIncluded', 'domainIncluded', 'sslIncluded', 'deploymentIncluded',
  ] as const).forEach(k => pushBool(k));

  // Arrays from textarea (one per line)
  const lines = (s?: string) =>
    (s ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  const dl = lines(d.deliverablesText);
  const ex = lines(d.excludedServicesText);
  if (dl.length) out.deliverables       = dl;
  if (ex.length) out.excludedServices   = ex;

  // Payment milestones — drop empties
  const milestones = (d.paymentMilestones ?? [])
    .map(m => {
      const o: Record<string, unknown> = {};
      if (m.name && m.name.trim() !== '') o.name = m.name.trim();
      if (typeof m.percentage === 'number' && Number.isFinite(m.percentage)) o.percentage = m.percentage;
      if (typeof m.amount     === 'number' && Number.isFinite(m.amount))     o.amount     = m.amount;
      if (m.dueDate && m.dueDate.trim() !== '') o.dueDate = m.dueDate;
      return o;
    })
    .filter(m => m.name); // milestone requires a name
  if (milestones.length) out.paymentMilestones = milestones;

  return {
    title:    values.title.trim(),
    clientId: values.clientId || undefined,
    details:  out,
  };
}

/** Inverse of buildContractPayload — for pre-filling the edit form. */
export function detailsToFormValues(
  details: Partial<ContractFormValues['details']> & {
    deliverables?: string[];
    excludedServices?: string[];
  } | null | undefined,
): ContractFormValues['details'] {
  const d = (details ?? {}) as Record<string, unknown>;
  return {
    contractNumber:       (d.contractNumber as string)       ?? '',
    contractType:         (d.contractType as ContractType)   ?? '',
    projectName:          (d.projectName as string)          ?? '',
    clientName:           (d.clientName as string)           ?? '',
    clientCompany:        (d.clientCompany as string)        ?? '',
    clientEmail:          (d.clientEmail as string)          ?? '',
    clientPhone:          (d.clientPhone as string)          ?? '',
    clientAddress:        (d.clientAddress as string)        ?? '',
    projectDescription:   (d.projectDescription as string)   ?? '',
    scopeOfWork:          (d.scopeOfWork as string)          ?? '',
    deliverablesText:     ((d.deliverables as string[]) ?? []).join('\n'),
    excludedServicesText: ((d.excludedServices as string[]) ?? []).join('\n'),
    startDate:            (d.startDate as string)            ?? '',
    endDate:              (d.endDate as string)              ?? '',
    estimatedDuration:    (d.estimatedDuration as string)    ?? '',
    currency:             (d.currency as string)             ?? '',
    totalValue:           (d.totalValue as number)           ?? '',
    paymentMilestones:    ((d.paymentMilestones as ContractFormValues['details']['paymentMilestones']) ?? [])
      .map(m => ({
        name:       m?.name       ?? '',
        percentage: m?.percentage ?? '',
        amount:     m?.amount     ?? '',
        dueDate:    m?.dueDate    ?? '',
      })),
    freeRevisions:          (d.freeRevisions as number)          ?? '',
    additionalRevisionCost: (d.additionalRevisionCost as number) ?? '',
    warrantyPeriod:         (d.warrantyPeriod as string)         ?? '',
    supportPeriod:          (d.supportPeriod as string)          ?? '',
    ownershipType:          (d.ownershipType as OwnershipType)   ?? '',
    ndaIncluded:            (d.ndaIncluded as boolean)            ?? false,
    hostingIncluded:        (d.hostingIncluded as boolean)        ?? false,
    domainIncluded:         (d.domainIncluded as boolean)         ?? false,
    sslIncluded:            (d.sslIncluded as boolean)            ?? false,
    deploymentIncluded:     (d.deploymentIncluded as boolean)     ?? false,
    latePaymentPenalty:     (d.latePaymentPenalty as string)     ?? '',
    terminationTerms:       (d.terminationTerms as string)       ?? '',
    acceptancePeriodDays:   (d.acceptancePeriodDays as number)   ?? '',
    termsAndConditions:     (d.termsAndConditions as string)     ?? '',
  };
}
