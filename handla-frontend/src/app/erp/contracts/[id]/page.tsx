'use client';

/**
 * ERP — Contract Detail Page (/erp/contracts/[id])
 *
 * Displays full contract body, metadata sidebar, and action buttons.
 * CLIENT view with SENT status shows accept/reject panel with confirmation modals.
 * ADMIN/EMPLOYEE can edit (DRAFT), send (DRAFT), or download signed copy (SIGNED).
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, ChevronRight, FilePenLine, Send, CheckCircle2, XCircle,
  Pencil, Trash2, X, ArrowLeft, User, Briefcase, Calendar,
  Download, FileSignature, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { contractsApi } from '@/lib/api';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import type { Contract, ContractStatus, ContractDetails } from '@/types';
import {
  ContractFormFields, buildContractPayload, detailsToFormValues,
  type ContractFormValues,
} from '@/components/erp/ContractFormFields';

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ContractStatus, string> = {
  DRAFT:    'border-slate-400/30   bg-slate-400/10   text-slate-400',
  SENT:     'border-amber-400/30   bg-amber-400/10   text-amber-400',
  SIGNED:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  REJECTED: 'border-red-400/30     bg-red-400/10     text-red-400',
};

const STATUS_ICON: Record<ContractStatus, React.ComponentType<{ className?: string }>> = {
  DRAFT:    FilePenLine,
  SENT:     Send,
  SIGNED:   CheckCircle2,
  REJECTED: XCircle,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', opts ?? { year: 'numeric', month: 'long', day: 'numeric' });
}

function apiErrMsg(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-48 rounded bg-white/10" />
      <div className="rounded-2xl border border-white/5 bg-white/3 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/10" />
          <div className="space-y-2">
            <div className="h-6 w-56 rounded bg-white/10" />
            <div className="h-4 w-32 rounded bg-white/5" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 rounded-xl bg-white/5" />
        <div className="h-48 rounded-xl bg-white/5" />
      </div>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ isOpen, onClose, title, subtitle, children, size = 'sm' }: {
  isOpen: boolean; onClose: () => void;
  title: string; subtitle?: string; children: React.ReactNode;
  size?: 'sm' | 'xl';
}) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              'relative w-full rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl overflow-hidden',
              size === 'xl' ? 'max-w-3xl' : 'max-w-lg',
            )}
            role="dialog" aria-modal="true"
          >
            <div className="p-6 border-b border-white/5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{title}</h2>
                  {subtitle && <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>}
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors min-h-[36px]" aria-label={t('erp.ui.close')}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 max-h-[78vh] overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Edit Contract Modal ─────────────────────────────────────────────────────

function EditContractModal({ isOpen, onClose, contract, onSuccess }: {
  isOpen: boolean; onClose: () => void; contract: Contract; onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { register, handleSubmit, control, reset, formState: { errors } } =
    useForm<ContractFormValues>({
      defaultValues: {
        title: contract.title,
        clientId: contract.clientId,
        details: detailsToFormValues(contract.details),
      },
    });

  // Pre-fill form whenever modal opens or contract changes.
  useEffect(() => {
    if (isOpen) {
      reset({
        title: contract.title,
        clientId: contract.clientId,
        details: detailsToFormValues(contract.details),
      });
    }
  }, [isOpen, contract, reset]);

  const mutation = useMutation({
    mutationFn: (values: ContractFormValues) => {
      const payload = buildContractPayload(values);
      // Edit endpoint doesn't change clientId; strip it.
      const { clientId: _omit, ...rest } = payload;
      void _omit;
      return contractsApi.updateContract(contract.id, rest);
    },
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['erp-contract', contract.id] });
      qc.invalidateQueries({ queryKey: ['erp-contracts'] });
      onSuccess(); onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl"
      title={t('erp.contracts.modals.edit.title')}
      subtitle={t('erp.contracts.modals.edit.subtitle')}>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <ContractFormFields
          register={register}
          control={control}
          errors={errors}
          hideClientSelect
        />
        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {apiErrMsg(mutation.error, t('erp.contracts.errors.update'))}
          </p>
        )}
        <div className="flex gap-3 pt-2 sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-[#0d0d0d] border-t border-white/[0.06]">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">{t('erp.ui.cancel')}</button>
          <button type="submit" disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            {mutation.isPending ? t('erp.contracts.busy.saving') : t('erp.contracts.modals.edit.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Send Confirm Modal ───────────────────────────────────────────────────────

function SendConfirmModal({ isOpen, onClose, contract, onSuccess }: {
  isOpen: boolean; onClose: () => void; contract: Contract; onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => contractsApi.sendContract(contract.id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['erp-contract', contract.id] });
      qc.invalidateQueries({ queryKey: ['erp-contracts'] });
      onSuccess(); onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('erp.contracts.modals.send.title')}>
      <div className="space-y-4">
        <p className="text-sm text-white/70">
          {t('erp.contracts.detail.sendMessage', { title: contract.title })}
        </p>
        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {apiErrMsg(mutation.error, t('erp.contracts.errors.send'))}
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">{t('erp.ui.cancel')}</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/90 text-black font-semibold hover:bg-amber-400 transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            <Send className="w-4 h-4" />{mutation.isPending ? t('erp.contracts.busy.sending') : t('erp.contracts.modals.send.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ isOpen, onClose, contract }: {
  isOpen: boolean; onClose: () => void; contract: Contract;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => contractsApi.deleteContract(contract.id),
    onSuccess:  () => router.push('/erp/contracts'),
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('erp.contracts.modals.delete.title')}>
      <div className="space-y-4">
        <p className="text-sm text-white/70">
          {t('erp.contracts.detail.deleteMessage', { title: contract.title })}
        </p>
        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {apiErrMsg(mutation.error, t('erp.contracts.errors.delete'))}
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">{t('erp.ui.cancel')}</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            {mutation.isPending ? t('erp.contracts.busy.deleting') : t('erp.contracts.modals.delete.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Accept Confirm Modal ─────────────────────────────────────────────────────

function AcceptConfirmModal({ isOpen, onClose, contract, onSuccess }: {
  isOpen: boolean; onClose: () => void; contract: Contract; onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => contractsApi.acceptContract(contract.id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['erp-contract', contract.id] });
      qc.invalidateQueries({ queryKey: ['erp-contracts'] });
      onSuccess(); onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('erp.contracts.modals.accept.title')} subtitle={t('erp.contracts.modals.accept.subtitle')}>
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-sm text-emerald-300">
            {t('erp.contracts.detail.acceptNotice', { title: contract.title })}
          </p>
        </div>
        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {apiErrMsg(mutation.error, t('erp.contracts.errors.accept'))}
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">{t('erp.ui.cancel')}</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            <FileSignature className="w-4 h-4" />{mutation.isPending ? t('erp.contracts.busy.accepting') : t('erp.contracts.modals.accept.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Reject Confirm Modal ─────────────────────────────────────────────────────

function RejectConfirmModal({ isOpen, onClose, contract, onSuccess }: {
  isOpen: boolean; onClose: () => void; contract: Contract; onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => contractsApi.rejectContract(contract.id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['erp-contract', contract.id] });
      qc.invalidateQueries({ queryKey: ['erp-contracts'] });
      onSuccess(); onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('erp.contracts.modals.reject.title')}>
      <div className="space-y-4">
        <p className="text-sm text-white/70">
          {t('erp.contracts.detail.rejectMessage', { title: contract.title })}
        </p>
        {mutation.isError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {apiErrMsg(mutation.error, t('erp.contracts.errors.reject'))}
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[44px]">{t('erp.ui.cancel')}</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm disabled:opacity-50 min-h-[44px]">
            {mutation.isPending ? t('erp.contracts.busy.rejecting') : t('erp.contracts.modals.reject.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Structured Details Panel ─────────────────────────────────────────────────

function formatMoney(amount: number | undefined, currency?: string) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  const cur = (currency ?? 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amount);
  } catch {
    return `${cur} ${amount.toFixed(2)}`;
  }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3 py-1.5">
      <dt className="text-xs text-white/40 flex-shrink-0">{label}</dt>
      <dd className="text-xs text-white/85 text-right break-words">{value}</dd>
    </div>
  );
}

function DetailsSection({
  title, children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#fbbf24] mb-2.5">
        {title}
      </h3>
      <dl className="divide-y divide-white/[0.04]">{children}</dl>
    </div>
  );
}

function StructuredDetails({ details }: { details: ContractDetails }) {
  const { t } = useTranslation();
  const hasAny = (...vals: unknown[]) => vals.some(v => {
    if (v == null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });

  const yn = (b: boolean | undefined) =>
    b === true ? t('erp.ui.yes') : b === false ? t('erp.ui.no') : null;

  const sections: React.ReactNode[] = [];

  // Contract Information
  if (hasAny(details.contractNumber, details.contractType, details.projectName)) {
    sections.push(
      <DetailsSection key="contract-info" title={t('erp.contracts.detail.sections.contractInfo')}>
        {details.contractNumber && <DetailRow label={t('erp.contracts.detail.fields.contractNumber')} value={details.contractNumber} />}
        {details.contractType && (
          <DetailRow label={t('erp.contracts.detail.fields.type')} value={t(`erp.contractForm.contractType.${details.contractType}`)} />
        )}
        {details.projectName && <DetailRow label={t('erp.contracts.detail.fields.project')} value={details.projectName} />}
      </DetailsSection>
    );
  }

  // Client Information
  if (hasAny(details.clientName, details.clientCompany, details.clientEmail, details.clientPhone, details.clientAddress)) {
    sections.push(
      <DetailsSection key="client-info" title={t('erp.contracts.detail.sections.clientInfo')}>
        {details.clientName    && <DetailRow label={t('erp.contracts.detail.fields.name')}    value={details.clientName} />}
        {details.clientCompany && <DetailRow label={t('erp.contracts.detail.fields.company')} value={details.clientCompany} />}
        {details.clientEmail   && <DetailRow label={t('erp.contracts.detail.fields.email')}   value={details.clientEmail} />}
        {details.clientPhone   && <DetailRow label={t('erp.contracts.detail.fields.phone')}   value={details.clientPhone} />}
        {details.clientAddress && <DetailRow label={t('erp.contracts.detail.fields.address')} value={details.clientAddress} />}
      </DetailsSection>
    );
  }

  // Project Details
  if (hasAny(details.projectDescription, details.scopeOfWork, details.deliverables, details.excludedServices)) {
    sections.push(
      <DetailsSection key="project" title={t('erp.contracts.detail.sections.projectDetails')}>
        {details.projectDescription && <DetailRow label={t('erp.contracts.detail.fields.description')} value={<span className="whitespace-pre-wrap">{details.projectDescription}</span>} />}
        {details.scopeOfWork        && <DetailRow label={t('erp.contracts.detail.fields.scope')}       value={<span className="whitespace-pre-wrap">{details.scopeOfWork}</span>} />}
        {details.deliverables && details.deliverables.length > 0 && (
          <DetailRow label={t('erp.contracts.detail.fields.deliverables')} value={
            <ul className="text-right list-disc list-inside space-y-0.5">
              {details.deliverables.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          } />
        )}
        {details.excludedServices && details.excludedServices.length > 0 && (
          <DetailRow label={t('erp.contracts.detail.fields.excluded')} value={
            <ul className="text-right list-disc list-inside space-y-0.5">
              {details.excludedServices.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          } />
        )}
      </DetailsSection>
    );
  }

  // Timeline
  if (hasAny(details.startDate, details.endDate, details.estimatedDuration)) {
    sections.push(
      <DetailsSection key="timeline" title={t('erp.contracts.detail.sections.timeline')}>
        {details.startDate         && <DetailRow label={t('erp.contracts.detail.fields.startDate')} value={formatDate(details.startDate)} />}
        {details.endDate           && <DetailRow label={t('erp.contracts.detail.fields.endDate')}   value={formatDate(details.endDate)} />}
        {details.estimatedDuration && <DetailRow label={t('erp.contracts.detail.fields.duration')}   value={details.estimatedDuration} />}
      </DetailsSection>
    );
  }

  // Financial
  if (hasAny(details.currency, details.totalValue, details.paymentMilestones)) {
    sections.push(
      <DetailsSection key="financial" title={t('erp.contracts.detail.sections.financial')}>
        {details.currency && <DetailRow label={t('erp.contracts.detail.fields.currency')} value={details.currency.toUpperCase()} />}
        {typeof details.totalValue === 'number' && (
          <DetailRow label={t('erp.contracts.detail.fields.totalValue')} value={formatMoney(details.totalValue, details.currency)} />
        )}
        {details.paymentMilestones && details.paymentMilestones.length > 0 && (
          <DetailRow label={t('erp.contracts.detail.fields.milestones')} value={
            <ul className="text-right space-y-1">
              {details.paymentMilestones.map((m, i) => (
                <li key={i} className="text-xs">
                  <span className="text-white/85">{m.name}</span>
                  {typeof m.percentage === 'number' && <span className="text-white/50"> · {m.percentage}%</span>}
                  {typeof m.amount === 'number' && <span className="text-white/50"> · {formatMoney(m.amount, details.currency)}</span>}
                  {m.dueDate && <span className="text-white/40"> · {formatDate(m.dueDate)}</span>}
                </li>
              ))}
            </ul>
          } />
        )}
      </DetailsSection>
    );
  }

  // Revisions / Warranty
  if (hasAny(details.freeRevisions, details.additionalRevisionCost, details.warrantyPeriod, details.supportPeriod)) {
    sections.push(
      <DetailsSection key="rev-warr" title={t('erp.contracts.detail.sections.revWarranty')}>
        {typeof details.freeRevisions === 'number' && <DetailRow label={t('erp.contracts.detail.fields.freeRevisions')} value={details.freeRevisions} />}
        {typeof details.additionalRevisionCost === 'number' && (
          <DetailRow label={t('erp.contracts.detail.fields.additionalRevisionCost')} value={formatMoney(details.additionalRevisionCost, details.currency)} />
        )}
        {details.warrantyPeriod && <DetailRow label={t('erp.contracts.detail.fields.warrantyPeriod')} value={details.warrantyPeriod} />}
        {details.supportPeriod  && <DetailRow label={t('erp.contracts.detail.fields.supportPeriod')}  value={details.supportPeriod} />}
      </DetailsSection>
    );
  }

  // IP / NDA
  if (hasAny(details.ownershipType, details.ndaIncluded)) {
    sections.push(
      <DetailsSection key="ip-nda" title={t('erp.contracts.detail.sections.ipNda')}>
        {details.ownershipType && (
          <DetailRow label={t('erp.contracts.detail.fields.ownership')} value={t(`erp.contractForm.ownership.${details.ownershipType}`)} />
        )}
        {typeof details.ndaIncluded === 'boolean' && (
          <DetailRow label={t('erp.contracts.detail.fields.nda')} value={yn(details.ndaIncluded)} />
        )}
      </DetailsSection>
    );
  }

  // Hosting
  if (hasAny(details.hostingIncluded, details.domainIncluded, details.sslIncluded, details.deploymentIncluded)) {
    sections.push(
      <DetailsSection key="hosting" title={t('erp.contracts.detail.sections.hosting')}>
        {typeof details.hostingIncluded    === 'boolean' && <DetailRow label={t('erp.contracts.detail.fields.hosting')}    value={yn(details.hostingIncluded)} />}
        {typeof details.domainIncluded     === 'boolean' && <DetailRow label={t('erp.contracts.detail.fields.domain')}     value={yn(details.domainIncluded)} />}
        {typeof details.sslIncluded        === 'boolean' && <DetailRow label={t('erp.contracts.detail.fields.ssl')}        value={yn(details.sslIncluded)} />}
        {typeof details.deploymentIncluded === 'boolean' && <DetailRow label={t('erp.contracts.detail.fields.deployment')} value={yn(details.deploymentIncluded)} />}
      </DetailsSection>
    );
  }

  // Late payment / termination / acceptance
  if (hasAny(details.latePaymentPenalty, details.terminationTerms, details.acceptancePeriodDays)) {
    sections.push(
      <DetailsSection key="terms-misc" title={t('erp.contracts.detail.sections.termsMisc')}>
        {details.latePaymentPenalty && <DetailRow label={t('erp.contracts.detail.fields.latePayment')} value={details.latePaymentPenalty} />}
        {details.terminationTerms && (
          <DetailRow label={t('erp.contracts.detail.fields.termination')} value={<span className="whitespace-pre-wrap">{details.terminationTerms}</span>} />
        )}
        {typeof details.acceptancePeriodDays === 'number' && (
          <DetailRow label={t('erp.contracts.detail.fields.acceptancePeriod')} value={details.acceptancePeriodDays === 1 ? t('erp.contracts.detail.day', { count: details.acceptancePeriodDays }) : t('erp.contracts.detail.days', { count: details.acceptancePeriodDays })} />
        )}
      </DetailsSection>
    );
  }

  // Terms & Conditions
  if (details.termsAndConditions) {
    sections.push(
      <DetailsSection key="tnc" title={t('erp.contracts.detail.sections.tnc')}>
        <DetailRow label="" value={<span className="whitespace-pre-wrap">{details.termsAndConditions}</span>} />
      </DetailsSection>
    );
  }

  if (sections.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/5 bg-white/3 p-5">
      <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">
        {t('erp.contracts.detail.structuredTitle')}
      </h2>
      <div className="grid grid-cols-1 gap-3">{sections}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContractDetailPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const router   = useRouter();
  const params   = useParams<{ id: string }>();

  const [editOpen,   setEditOpen]   = useState(false);
  const [sendOpen,   setSendOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  // PDF url state (legacy S3-stored signed copy)
  const [pdfUrl,     setPdfUrl]     = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError,   setPdfError]   = useState<string | null>(null);

  // Client-side PDF export state (jspdf + QR code)
  const [pdfDlLoading, setPdfDlLoading] = useState(false);
  const [pdfDlError,   setPdfDlError]   = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['erp-contract', params.id],
    queryFn:  () => contractsApi.getContract(params.id).then(r => r.data.data.contract as Contract),
    staleTime: 30_000, retry: 1, refetchOnWindowFocus: false,
    enabled: !!params.id,
  });

  const fetchPdfUrl = async () => {
    if (!data) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const res = await contractsApi.getPdfUrl(data.id);
      const url = (res.data.data as { url?: string })?.url ?? res.data.data;
      setPdfUrl(url as string);
      window.open(url as string, '_blank');
    } catch {
      setPdfError(t('erp.contracts.detail.pdfUrlError'));
    } finally {
      setPdfLoading(false);
    }
  };

  if (!mounted) return null;
  if (isLoading) return <div className="p-6"><DetailSkeleton /></div>;

  if (isError || !data) {
    return (
      <div className="text-center py-20">
        <p className="text-white/50 mb-4">{t('erp.contracts.detail.notFound')}</p>
        <button onClick={() => router.push('/erp/contracts')}
          className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-sm text-white/70 transition-colors">
          ← {t('erp.contracts.viewAll')}
        </button>
      </div>
    );
  }

  const contract   = data;
  const StatusIcon = STATUS_ICON[contract.status] ?? FilePenLine;
  const clientName = contract.client?.user?.name ?? t('erp.contracts.unknownClient');
  const ownerName  = contract.owner?.name ?? t('erp.ui.unassigned');

  const isAdmin    = user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';
  const isClient   = user?.role === 'CLIENT';
  const canEdit    = (isAdmin || isEmployee) && contract.status === 'DRAFT';
  const canSend    = (isAdmin || isEmployee) && contract.status === 'DRAFT';
  const canDelete  = isAdmin && contract.status === 'DRAFT';
  const canAccept  = isClient && contract.status === 'SENT';
  const canReject  = isClient && contract.status === 'SENT';
  const canDownload= contract.status === 'SIGNED' && !!contract.s3Key;
  // Client-side PDF is available to anyone who can already view the contract,
  // regardless of status — admin, employee owner, or assigned client.
  const canDownloadPdf = isAdmin || isEmployee || isClient;

  // Generate a print-friendly black-and-white PDF on the client. The PDF
  // library is loaded on first click to keep the page bundle light.
  const handleDownloadPdf = async () => {
    if (!contract) return;
    setPdfDlLoading(true);
    setPdfDlError(null);
    try {
      const { downloadContractPdf } = await import('@/lib/pdf/contract-pdf');
      await downloadContractPdf(contract);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('Contract PDF generation failed', e);
      setPdfDlError(e?.message ?? t('erp.contracts.detail.pdfGenFailedShort'));
    } finally {
      setPdfDlLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-white/40" aria-label="Breadcrumb">
        <Link href="/erp/contracts" className="hover:text-white transition-colors flex items-center gap-1">
          <FileText className="w-4 h-4" /> {t('erp.contracts.title')}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white/70 truncate max-w-[200px]">{contract.title}</span>
      </nav>

      {/* Header card */}
      <div className="rounded-2xl border border-white/5 bg-white/3 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Icon */}
          <div className={cn('flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold', getAvatarColor(contract.title))}>
            {getInitials(contract.title)}
          </div>

          {/* Title block */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-white truncate">{contract.title}</h1>
              <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', STATUS_BADGE[contract.status])}>
                <StatusIcon className="w-3 h-3" />
                {t(`erp.contractStatus.${contract.status}`)}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-white/50">
              <Link href={`/erp/clients/${contract.clientId}`}
                className="flex items-center gap-1.5 hover:text-[#fbbf24] transition-colors">
                <Briefcase className="w-3.5 h-3.5" />{clientName}
              </Link>
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{ownerName}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            {canEdit && (
              <button onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm min-h-[40px]">
                <Pencil className="w-4 h-4" /> {t('erp.ui.edit')}
              </button>
            )}
            {canSend && (
              <button onClick={() => setSendOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors text-sm min-h-[40px]">
                <Send className="w-4 h-4" /> {t('erp.contracts.actions.send')}
              </button>
            )}
            {canDownloadPdf && (
              <button
                onClick={handleDownloadPdf}
                disabled={pdfDlLoading}
                title={t('erp.contracts.detail.downloadPdfTitle')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#fbbf24]/15 border border-[#fbbf24]/30 text-[#fbbf24] hover:bg-[#fbbf24]/25 transition-colors text-sm disabled:opacity-60 disabled:cursor-wait min-h-[40px]"
              >
                {pdfDlLoading ? (
                  <><span className="w-4 h-4 border-2 border-[#fbbf24]/30 border-t-[#fbbf24] rounded-full animate-spin" /> {t('erp.contracts.detail.generating')}</>
                ) : (
                  <><Download className="w-4 h-4" /> {t('erp.contracts.detail.downloadPdf')}</>
                )}
              </button>
            )}
            {canDownload && (
              <button onClick={fetchPdfUrl} disabled={pdfLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm disabled:opacity-50 min-h-[40px]">
                {pdfLoading ? (
                  <><span className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> {t('erp.contracts.detail.loading')}</>
                ) : (
                  <><Download className="w-4 h-4" /> {t('erp.contracts.detail.download')}</>
                )}
              </button>
            )}
            {canDelete && (
              <button onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-sm min-h-[40px]">
                <Trash2 className="w-4 h-4" /> {t('erp.ui.delete')}
              </button>
            )}
            <button onClick={() => router.push('/erp/contracts')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-colors text-sm min-h-[40px]">
              <ArrowLeft className="w-4 h-4" /> {t('erp.ui.back')}
            </button>
          </div>
        </div>

        {/* Meta pills */}
        <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-xs text-white/50 px-3 py-1.5 rounded-lg bg-white/5">
            <Calendar className="w-3.5 h-3.5 text-[#fbbf24]" /> {t('erp.contracts.detail.createdPill', { date: formatDate(contract.createdAt) })}
          </div>
          {contract.sentAt && (
            <div className="flex items-center gap-1.5 text-xs text-white/50 px-3 py-1.5 rounded-lg bg-white/5">
              <Send className="w-3.5 h-3.5 text-amber-400" /> {t('erp.contracts.detail.sentPill', { date: formatDate(contract.sentAt) })}
            </div>
          )}
          {contract.signedAt && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400/70 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('erp.contracts.detail.signedPill', { date: formatDate(contract.signedAt) })}
            </div>
          )}
        </div>

        {/* PDF error (S3 signed copy) */}
        {pdfError && (
          <p className="mt-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {pdfError}
          </p>
        )}
        {/* PDF error (client-side generator) */}
        {pdfDlError && (
          <p className="mt-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {t('erp.contracts.detail.pdfGenFailed', { error: pdfDlError })}
          </p>
        )}
        {pdfUrl && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
            <ExternalLink className="w-3.5 h-3.5" />
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-emerald-300">
              {t('erp.contracts.signedDocumentLink')}
            </a>
          </div>
        )}
      </div>

      {/* CLIENT: Accept/Reject panel (SENT status only) */}
      {isClient && contract.status === 'SENT' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-amber-300 flex items-center gap-2">
                <Send className="w-4 h-4" /> {t('erp.contracts.awaitingSignature')}
              </h2>
              <p className="text-sm text-white/60 mt-1">
                {t('erp.contracts.awaitingSignatureHint')}
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button onClick={() => setRejectOpen(true)}
                className="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium min-h-[44px]">
                <XCircle className="inline w-4 h-4 mr-1.5" /> {t('erp.contracts.actions.reject')}
              </button>
              <button onClick={() => setAcceptOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fbbf24] text-black font-semibold hover:bg-[#f59e0b] transition-colors text-sm min-h-[44px]">
                <FileSignature className="w-4 h-4" /> {t('erp.contracts.actions.accept')}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* CONTRACT SIGNED banner */}
      {contract.status === 'SIGNED' && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">{t('erp.contracts.signedBanner')}</p>
            <p className="text-xs text-white/50">
              {t('erp.contracts.signedOn', { date: formatDate(contract.signedAt) })}
              {canDownload && t('erp.contracts.detail.signedWithDownload')}
            </p>
          </div>
        </div>
      )}

      {/* CONTRACT REJECTED banner */}
      {contract.status === 'REJECTED' && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-300">{t('erp.contracts.rejectedBanner')}</p>
            <p className="text-xs text-white/50">{t('erp.contracts.rejectedHint')}</p>
          </div>
        </div>
      )}

      {/* Body + Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contract Body / Structured Details */}
        <div className="lg:col-span-2 space-y-5">
          {contract.details && Object.keys(contract.details).length > 0 && (
            <StructuredDetails details={contract.details} />
          )}
          <div className="rounded-xl border border-white/5 bg-white/3 p-5">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">
              {contract.details && Object.keys(contract.details).length > 0
                ? t('erp.contracts.detail.fullContractText')
                : t('erp.contracts.contractTerms')}
            </h2>
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{contract.body}</p>
            </div>
          </div>
        </div>

        {/* Metadata sidebar */}
        <div className="rounded-xl border border-white/5 bg-white/3 p-5 space-y-5">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide">{t('erp.contracts.contractDetails')}</h2>
          <dl className="space-y-3">
            {[
              { key: 'status',  label: t('erp.contracts.fields.status'),  value: t(`erp.contractStatus.${contract.status}`) },
              { key: 'client',  label: t('erp.contracts.fields.client'),  value: clientName },
              { key: 'owner',   label: t('erp.contracts.fields.owner'),   value: ownerName },
              { key: 'created', label: t('erp.contracts.fields.createdAt'), value: formatDate(contract.createdAt, { year: 'numeric', month: 'short', day: 'numeric' }) },
              { key: 'sent',    label: t('erp.contracts.fields.sentAt'),   value: formatDate(contract.sentAt,    { year: 'numeric', month: 'short', day: 'numeric' }) },
              { key: 'signed',  label: t('erp.contracts.fields.signedAt'), value: formatDate(contract.signedAt,  { year: 'numeric', month: 'short', day: 'numeric' }) },
              { key: 'updated', label: t('erp.ui.updatedAt'), value: formatDate(contract.updatedAt, { year: 'numeric', month: 'short', day: 'numeric' }) },
            ].map(({ key, label, value }) => (
              <div key={key} className="flex justify-between items-start gap-2">
                <dt className="text-xs text-white/40">{label}</dt>
                <dd className="text-xs text-white/80 text-right">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Client link */}
          <Link
            href={`/erp/clients/${contract.clientId}`}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm"
          >
            <Briefcase className="w-4 h-4" /> {t('erp.contracts.actions.viewClient')}
            <ExternalLink className="w-3 h-3 ml-auto" />
          </Link>
        </div>
      </div>

      {/* Modals */}
      {canEdit && (
        <EditContractModal isOpen={editOpen} onClose={() => setEditOpen(false)}
          contract={contract} onSuccess={() => refetch()} />
      )}
      {canSend && (
        <SendConfirmModal isOpen={sendOpen} onClose={() => setSendOpen(false)}
          contract={contract} onSuccess={() => refetch()} />
      )}
      {canDelete && (
        <DeleteConfirmModal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} contract={contract} />
      )}
      {canAccept && (
        <AcceptConfirmModal isOpen={acceptOpen} onClose={() => setAcceptOpen(false)}
          contract={contract} onSuccess={() => refetch()} />
      )}
      {canReject && (
        <RejectConfirmModal isOpen={rejectOpen} onClose={() => setRejectOpen(false)}
          contract={contract} onSuccess={() => refetch()} />
      )}
    </div>
  );
}
