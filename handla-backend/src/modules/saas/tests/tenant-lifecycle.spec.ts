import {
  canTransition,
  assertTransition,
  allowedNext,
  isTerminal,
} from '../services/tenant-lifecycle';
import { TenantStatus } from '../../../common/enums';

/**
 * SAAS-1 — Pure FSM tests. The lifecycle is the single source of truth for
 * legal tenant transitions, so exhaustively pin the allowed/denied edges.
 */
describe('tenant-lifecycle FSM', () => {
  it('allows the documented forward path', () => {
    expect(canTransition(TenantStatus.PENDING, TenantStatus.PROVISIONING)).toBe(true);
    expect(canTransition(TenantStatus.PROVISIONING, TenantStatus.ACTIVE)).toBe(true);
    expect(canTransition(TenantStatus.ACTIVE, TenantStatus.SUSPENDED)).toBe(true);
    expect(canTransition(TenantStatus.SUSPENDED, TenantStatus.ACTIVE)).toBe(true);
  });

  it('allows retry from FAILED and archive from terminal-ish states', () => {
    expect(canTransition(TenantStatus.FAILED, TenantStatus.PROVISIONING)).toBe(true);
    expect(canTransition(TenantStatus.ACTIVE, TenantStatus.ARCHIVED)).toBe(true);
    expect(canTransition(TenantStatus.SUSPENDED, TenantStatus.ARCHIVED)).toBe(true);
    expect(canTransition(TenantStatus.FAILED, TenantStatus.ARCHIVED)).toBe(true);
    expect(canTransition(TenantStatus.PENDING, TenantStatus.ARCHIVED)).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition(TenantStatus.PENDING, TenantStatus.ACTIVE)).toBe(false);
    expect(canTransition(TenantStatus.ACTIVE, TenantStatus.PROVISIONING)).toBe(false);
    expect(canTransition(TenantStatus.SUSPENDED, TenantStatus.PROVISIONING)).toBe(false);
    // no self-loops
    expect(canTransition(TenantStatus.ACTIVE, TenantStatus.ACTIVE)).toBe(false);
  });

  it('ARCHIVED is terminal', () => {
    expect(isTerminal(TenantStatus.ARCHIVED)).toBe(true);
    expect(allowedNext(TenantStatus.ARCHIVED)).toEqual([]);
    expect(canTransition(TenantStatus.ARCHIVED, TenantStatus.ACTIVE)).toBe(false);
  });

  it('assertTransition throws a 400-style error for illegal edges', () => {
    expect(() => assertTransition(TenantStatus.ACTIVE, TenantStatus.SUSPENDED)).not.toThrow();
    let err: any;
    try {
      assertTransition(TenantStatus.PENDING, TenantStatus.ACTIVE);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.status ?? err.getStatus?.()).toBe(400);
  });
});
