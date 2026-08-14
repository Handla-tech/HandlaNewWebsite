import { BadRequestException } from '@nestjs/common';
import { TenantStatus } from '../../../common/enums';

/**
 * SAAS-1 — Pure, side-effect-free tenant lifecycle finite-state machine.
 *
 * Kept separate from the service so it is trivially unit-testable and is the
 * single source of truth for which transitions are legal.
 *
 *   PENDING ─▶ PROVISIONING ─▶ ACTIVE ─▶ SUSPENDED ─▶ ACTIVE
 *      │            │            │           │
 *      │            ▼            ▼           ▼
 *      └─────────▶ FAILED ◀──────┘        ARCHIVED
 *                   │
 *                   └─▶ PROVISIONING (retry)
 *   ACTIVE/SUSPENDED/FAILED/PENDING ─▶ ARCHIVED
 */
const ALLOWED: Record<TenantStatus, TenantStatus[]> = {
  [TenantStatus.PENDING]: [TenantStatus.PROVISIONING, TenantStatus.ARCHIVED, TenantStatus.FAILED],
  [TenantStatus.PROVISIONING]: [TenantStatus.ACTIVE, TenantStatus.FAILED],
  [TenantStatus.ACTIVE]: [TenantStatus.SUSPENDED, TenantStatus.ARCHIVED],
  [TenantStatus.SUSPENDED]: [TenantStatus.ACTIVE, TenantStatus.ARCHIVED],
  [TenantStatus.FAILED]: [TenantStatus.PROVISIONING, TenantStatus.ARCHIVED],
  [TenantStatus.ARCHIVED]: [], // terminal (hard-delete is a separate guarded op)
};

export function canTransition(from: TenantStatus, to: TenantStatus): boolean {
  if (from === to) return false;
  return (ALLOWED[from] ?? []).includes(to);
}

export function assertTransition(from: TenantStatus, to: TenantStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(`Illegal tenant transition ${from} → ${to}`);
  }
}

export function allowedNext(from: TenantStatus): TenantStatus[] {
  return ALLOWED[from] ?? [];
}

export function isTerminal(status: TenantStatus): boolean {
  return (ALLOWED[status] ?? []).length === 0;
}
