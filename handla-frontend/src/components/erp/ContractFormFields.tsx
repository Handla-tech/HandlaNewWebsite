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

import {
  useFieldArray, useWatch,
  Control, UseFormRegister, FieldErrors, Controller,
  UseFormSetValue, UseFormGetValues,
} from 'react-hook-form';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
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
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'details.paymentMilestones',
  });

  return (
    <div className="space-y-2">
      {fields.length === 0 && (
        <p className="text-[11px] text-white/30 italic">{t('erp.contractForm.noMilestones')}</p>
      )}
      {fields.map((field, idx) => (
        <div
          key={field.id}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
              {t('erp.contractForm.milestone', { index: idx + 1 })}
            </p>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              aria-label={t('erp.contractForm.removeMilestone', { index: idx + 1 })}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={t('erp.contractForm.fields.name')}>
              <input
                {...register(`details.paymentMilestones.${idx}.name` as const)}
                placeholder={t('erp.contractForm.fields.namePlaceholder')}
                className={inputCls()}
              />
            </Field>
            <Field label={t('erp.contractForm.fields.dueDate')}>
              <input
                type="date"
                {...register(`details.paymentMilestones.${idx}.dueDate` as const)}
                className={inputCls()}
              />
            </Field>
            <Field label={t('erp.contractForm.fields.percentage')} hint={t('erp.contractForm.fields.percentageHint')}>
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
            <Field label={t('erp.contractForm.fields.amount')} hint={t('erp.contractForm.fields.amountHint')}>
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
        <Plus className="w-3.5 h-3.5" /> {t('erp.contractForm.addMilestone')}
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
  /** Required to enable client auto-fill on clientId change (create mode). */
  setValue?:  UseFormSetValue<ContractFormValues>;
  getValues?: UseFormGetValues<ContractFormValues>;
}

export function ContractFormFields({
  register, control, errors, clients = [], clientsLoading = false,
  hideClientSelect = false, statusBadge, setValue, getValues,
}: ContractFormFieldsProps) {
  const { t } = useTranslation();
  // ── Client auto-fill ──────────────────────────────────────────────────────
  //
  // When the user picks a client from the dropdown, pre-populate the
  // CLIENT INFORMATION section (clientName / clientCompany / clientEmail /
  // clientPhone / clientAddress) from the selected Client record so they
  // don't have to retype the same data the client profile already holds.
  //
  // We only fill fields that are currently EMPTY — this way any value the
  // user has already typed in is preserved. We also stash the previous
  // clientId in a ref so that *switching* clients overwrites the previously
  // auto-filled values (but still leaves user-edited values alone, because
  // we re-check emptiness on every assignment).
  const watchedClientId = useWatch({ control, name: 'clientId' });
  const prevClientIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Disabled when:
    //   • The Client select is hidden (edit mode — clientId is immutable).
    //   • No setValue/getValues provided (caller opted out of auto-fill).
    //   • No client picked yet.
    //   • Clients haven't loaded yet so we couldn't look one up anyway.
    if (hideClientSelect || !setValue || !getValues) return;
    if (!watchedClientId) return;
    if (clients.length === 0) return;
    if (prevClientIdRef.current === watchedClientId) return;

    const selected = clients.find(c => c.id === watchedClientId);
    if (!selected) return;

    const isFirstFill = prevClientIdRef.current === null;
    prevClientIdRef.current = watchedClientId;

    const current = getValues('details') ?? {};

    // On the FIRST fill we only populate empties (preserves anything the
    // user typed before picking a client). On SUBSEQUENT switches we
    // overwrite the previously auto-filled values with the new client's
    // data — but still keep any field that doesn't match the *previous*
    // client (i.e. user manually edited it).
    const fill = (
      key: 'clientName' | 'clientCompany' | 'clientEmail' | 'clientPhone' | 'clientAddress',
      value: string | null | undefined,
    ) => {
      if (!value) return;
      const existing = (current as Record<string, unknown>)[key];
      const isEmpty = existing === undefined || existing === null || existing === '';
      if (isFirstFill && !isEmpty) return;
      setValue(`details.${key}` as const, value, { shouldDirty: true, shouldTouch: false });
    };

    fill('clientName',    selected.user?.name);
    fill('clientCompany', selected.company ?? selected.user?.company);
    fill('clientEmail',   selected.user?.email);
    fill('clientPhone',   selected.user?.phoneNumber);
    fill('clientAddress', selected.user?.location);
  }, [watchedClientId, clients, hideClientSelect, setValue, getValues]);

  return (
    <div className="space-y-3">
      {/* ── REQUIRED HEADER ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#fbbf24]/20 bg-[#fbbf24]/[0.04] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#fbbf24]">
            {t('erp.contractForm.required')}
          </p>
          {statusBadge}
        </div>

        <Field label={t('erp.contractForm.titleLabel')} error={errors.title?.message}>
          <input
            {...register('title')}
            placeholder={t('erp.contractForm.titlePlaceholder')}
            className={inputCls(!!errors.title)}
          />
        </Field>

        {!hideClientSelect && (
          <Field label={t('erp.contractForm.clientLabel')} error={errors.clientId?.message}>
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
                  ? t('erp.contractForm.clientLoading')
                  : clients.length === 0
                    ? t('erp.contractForm.clientNone')
                    : t('erp.contractForm.clientSelect')}
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
        title={t('erp.contractForm.sections.contractInfo')}
        description={t('erp.contractForm.sections.contractInfoDesc')}
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('erp.contractForm.fields.contractNumber')}>
            <input
              {...register('details.contractNumber')}
              placeholder="CN-2026-001"
              className={inputCls()}
            />
          </Field>
          <Field label={t('erp.contractForm.fields.contractType')}>
            <select
              {...register('details.contractType')}
              className={cn(inputCls(), 'bg-[#0f0f0f]')}
            >
              <option value="">{t('erp.contractForm.select')}</option>
              <option value="FIXED_PRICE">{t('erp.contractForm.contractType.FIXED_PRICE')}</option>
              <option value="HOURLY">{t('erp.contractForm.contractType.HOURLY')}</option>
              <option value="RETAINER">{t('erp.contractForm.contractType.RETAINER')}</option>
              <option value="MILESTONE">{t('erp.contractForm.contractType.MILESTONE')}</option>
              <option value="MAINTENANCE">{t('erp.contractForm.contractType.MAINTENANCE')}</option>
              <option value="CONSULTATION">{t('erp.contractForm.contractType.CONSULTATION')}</option>
            </select>
          </Field>
          <Field label={t('erp.contractForm.fields.projectName')} className="sm:col-span-2">
            <input
              {...register('details.projectName')}
              placeholder={t('erp.contractForm.fields.projectNamePlaceholder')}
              className={inputCls()}
            />
          </Field>
        </div>
      </Section>

      {/* ── 2. CLIENT INFORMATION ──────────────────────────────────────────── */}
      <Section title={t('erp.contractForm.sections.clientInfo')} description={t('erp.contractForm.sections.clientInfoDesc')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('erp.contractForm.fields.clientName')}>
            <input {...register('details.clientName')} className={inputCls()} />
          </Field>
          <Field label={t('erp.contractForm.fields.company')}>
            <input {...register('details.clientCompany')} className={inputCls()} />
          </Field>
          <Field label={t('erp.contractForm.fields.email')}>
            <input
              type="email"
              {...register('details.clientEmail')}
              placeholder={t('erp.contractForm.fields.emailPlaceholder')}
              className={inputCls()}
            />
          </Field>
          <Field label={t('erp.contractForm.fields.phone')}>
            <input
              {...register('details.clientPhone')}
              placeholder={t('erp.contractForm.fields.phonePlaceholder')}
              className={inputCls()}
            />
          </Field>
          <Field label={t('erp.contractForm.fields.address')} className="sm:col-span-2">
            <textarea
              {...register('details.clientAddress')}
              rows={2}
              placeholder={t('erp.contractForm.fields.addressPlaceholder')}
              className={cn(inputCls(), 'resize-y min-h-[60px] h-auto py-2')}
            />
          </Field>
        </div>
      </Section>

      {/* ── 3. PROJECT DETAILS ─────────────────────────────────────────────── */}
      <Section title={t('erp.contractForm.sections.projectDetails')} description={t('erp.contractForm.sections.projectDetailsDesc')}>
        <Field label={t('erp.contractForm.fields.projectDescription')}>
          <textarea
            {...register('details.projectDescription')}
            rows={3}
            placeholder={t('erp.contractForm.fields.projectDescriptionPlaceholder')}
            className={cn(inputCls(), 'resize-y min-h-[80px] h-auto py-2')}
          />
        </Field>
        <Field label={t('erp.contractForm.fields.scopeOfWork')}>
          <textarea
            {...register('details.scopeOfWork')}
            rows={4}
            placeholder={t('erp.contractForm.fields.scopeOfWorkPlaceholder')}
            className={cn(inputCls(), 'resize-y min-h-[100px] h-auto py-2')}
          />
        </Field>
        <Field label={t('erp.contractForm.fields.deliverables')} hint={t('erp.contractForm.fields.onePerLine')}>
          <textarea
            {...register('details.deliverablesText')}
            rows={4}
            placeholder={'e.g.\nLanding page design\nResponsive HTML/CSS implementation\nCMS integration'}
            className={cn(inputCls(), 'resize-y min-h-[100px] h-auto py-2')}
          />
        </Field>
        <Field label={t('erp.contractForm.fields.excludedServices')} hint={t('erp.contractForm.fields.onePerLine')}>
          <textarea
            {...register('details.excludedServicesText')}
            rows={3}
            placeholder={'e.g.\nMarketing campaigns\nThird-party integrations'}
            className={cn(inputCls(), 'resize-y min-h-[80px] h-auto py-2')}
          />
        </Field>
      </Section>

      {/* ── 4. TIMELINE ────────────────────────────────────────────────────── */}
      <Section title={t('erp.contractForm.sections.timeline')} description={t('erp.contractForm.sections.timelineDesc')}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label={t('erp.contractForm.fields.startDate')}>
            <input type="date" {...register('details.startDate')} className={inputCls()} />
          </Field>
          <Field label={t('erp.contractForm.fields.endDate')}>
            <input type="date" {...register('details.endDate')} className={inputCls()} />
          </Field>
          <Field label={t('erp.contractForm.fields.estimatedDuration')}>
            <input
              {...register('details.estimatedDuration')}
              placeholder={t('erp.contractForm.fields.estimatedDurationPlaceholder')}
              className={inputCls()}
            />
          </Field>
        </div>
      </Section>

      {/* ── 5. FINANCIAL DETAILS ───────────────────────────────────────────── */}
      <Section title={t('erp.contractForm.sections.financial')} description={t('erp.contractForm.sections.financialDesc')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('erp.contractForm.fields.currency')}>
            <input
              {...register('details.currency')}
              placeholder="USD"
              className={inputCls()}
            />
          </Field>
          <Field label={t('erp.contractForm.fields.totalValue')}>
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
      <Section title={t('erp.contractForm.sections.payment')} description={t('erp.contractForm.sections.paymentDesc')}>
        <PaymentMilestonesField control={control} register={register} />
      </Section>

      {/* ── 7. REVISION POLICY ─────────────────────────────────────────────── */}
      <Section title={t('erp.contractForm.sections.revision')} description={t('erp.contractForm.sections.revisionDesc')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('erp.contractForm.fields.freeRevisions')}>
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
          <Field label={t('erp.contractForm.fields.additionalRevisionCost')}>
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
      <Section title={t('erp.contractForm.sections.warranty')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('erp.contractForm.fields.warrantyPeriod')}>
            <input
              {...register('details.warrantyPeriod')}
              placeholder={t('erp.contractForm.fields.warrantyPeriodPlaceholder')}
              className={inputCls()}
            />
          </Field>
          <Field label={t('erp.contractForm.fields.supportPeriod')}>
            <input
              {...register('details.supportPeriod')}
              placeholder={t('erp.contractForm.fields.supportPeriodPlaceholder')}
              className={inputCls()}
            />
          </Field>
        </div>
      </Section>

      {/* ── 9. INTELLECTUAL PROPERTY ───────────────────────────────────────── */}
      <Section title={t('erp.contractForm.sections.ip')} description={t('erp.contractForm.sections.ipDesc')}>
        <Field label={t('erp.contractForm.fields.ownershipType')}>
          <select
            {...register('details.ownershipType')}
            className={cn(inputCls(), 'bg-[#0f0f0f]')}
          >
            <option value="">{t('erp.contractForm.select')}</option>
            <option value="CLIENT_OWNS_EVERYTHING">{t('erp.contractForm.ownership.CLIENT_OWNS_EVERYTHING')}</option>
            <option value="OWNERSHIP_TRANSFERS_AFTER_PAYMENT">
              {t('erp.contractForm.ownership.OWNERSHIP_TRANSFERS_AFTER_PAYMENT')}
            </option>
            <option value="SHARED_OWNERSHIP">{t('erp.contractForm.ownership.SHARED_OWNERSHIP')}</option>
          </select>
        </Field>
      </Section>

      {/* ── 10. CONFIDENTIALITY ────────────────────────────────────────────── */}
      <Section title={t('erp.contractForm.sections.confidentiality')}>
        <Controller
          name="details.ndaIncluded"
          control={control}
          render={({ field }) => (
            <Toggle
              label={t('erp.contractForm.toggles.nda')}
              description={t('erp.contractForm.toggles.ndaDesc')}
              checked={!!field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Section>

      {/* ── 11. HOSTING & DEPLOYMENT ───────────────────────────────────────── */}
      <Section title={t('erp.contractForm.sections.hosting')} description={t('erp.contractForm.sections.hostingDesc')}>
        <div className="space-y-2">
          {([
            ['hostingIncluded',    'erp.contractForm.toggles.hosting'],
            ['domainIncluded',     'erp.contractForm.toggles.domain'],
            ['sslIncluded',        'erp.contractForm.toggles.ssl'],
            ['deploymentIncluded', 'erp.contractForm.toggles.deployment'],
          ] as const).map(([name, labelKey]) => (
            <Controller
              key={name}
              name={`details.${name}` as const}
              control={control}
              render={({ field }) => (
                <Toggle
                  label={t(labelKey)}
                  checked={!!field.value}
                  onChange={field.onChange}
                />
              )}
            />
          ))}
        </div>
      </Section>

      {/* ── 12. LATE PAYMENT TERMS ─────────────────────────────────────────── */}
      <Section title={t('erp.contractForm.sections.latePayment')}>
        <Field label={t('erp.contractForm.fields.latePaymentPenalty')}>
          <input
            {...register('details.latePaymentPenalty')}
            placeholder={t('erp.contractForm.fields.latePaymentPenaltyPlaceholder')}
            className={inputCls()}
          />
        </Field>
      </Section>

      {/* ── 13. TERMINATION ────────────────────────────────────────────────── */}
      <Section title={t('erp.contractForm.sections.termination')}>
        <Field label={t('erp.contractForm.fields.terminationTerms')}>
          <textarea
            {...register('details.terminationTerms')}
            rows={3}
            placeholder={t('erp.contractForm.fields.terminationTermsPlaceholder')}
            className={cn(inputCls(), 'resize-y min-h-[80px] h-auto py-2')}
          />
        </Field>
      </Section>

      {/* ── 14. ACCEPTANCE ─────────────────────────────────────────────────── */}
      <Section title={t('erp.contractForm.sections.acceptance')}>
        <Field
          label={t('erp.contractForm.fields.acceptancePeriod')}
          hint={t('erp.contractForm.fields.acceptancePeriodHint')}
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
      <Section title={t('erp.contractForm.sections.terms')} description={t('erp.contractForm.sections.termsDesc')}>
        <Field label={t('erp.contractForm.fields.termsAndConditions')}>
          <textarea
            {...register('details.termsAndConditions')}
            rows={6}
            placeholder={t('erp.contractForm.fields.termsAndConditionsPlaceholder')}
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
