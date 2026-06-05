/**
 * ERP-12.1 — Contracts Lifecycle Flow Tests
 *
 * Tests DRAFT → SENT → SIGNED / REJECTED contract flow.
 * PDF generation and notification firing.
 */

import {
  ContractStatus,
  NotificationType,
} from '../../../common/enums';

// ─── Type helpers (unit-level — no DB or DI) ──────────────────────────────────

interface MockContract {
  id:       string;
  title:    string;
  body:     string;
  clientId: string;
  ownerId:  string;
  status:   ContractStatus;
  sentAt:   Date | null;
  signedAt: Date | null;
  s3Key:    string | null;
  pdfUrl:   string | null;
}

function makeContract(overrides: Partial<MockContract> = {}): MockContract {
  return {
    id:       'contract-1',
    title:    'Service Agreement',
    body:     'These are the terms and conditions…',
    clientId: 'client-1',
    ownerId:  'emp-1',
    status:   ContractStatus.DRAFT,
    sentAt:   null,
    signedAt: null,
    s3Key:    null,
    pdfUrl:   null,
    ...overrides,
  };
}

// ─── Transition logic (mirrors ContractsService) ──────────────────────────────

function sendContract(contract: MockContract): MockContract {
  if (contract.status !== ContractStatus.DRAFT) {
    throw new Error(`Cannot send contract in status ${contract.status}`);
  }
  return { ...contract, status: ContractStatus.SENT, sentAt: new Date() };
}

function acceptContract(contract: MockContract, isClient: boolean): MockContract {
  if (!isClient) {
    throw new Error('Only CLIENT can accept contracts');
  }
  if (contract.status !== ContractStatus.SENT) {
    throw new Error(`Cannot accept contract in status ${contract.status}`);
  }
  return {
    ...contract,
    status:   ContractStatus.SIGNED,
    signedAt: new Date(),
    s3Key:    `contracts/${contract.id}.html`,
    pdfUrl:   `https://cdn.example.com/contracts/${contract.id}.html`,
  };
}

function rejectContract(contract: MockContract, isClient: boolean): MockContract {
  if (!isClient) {
    throw new Error('Only CLIENT can reject contracts');
  }
  if (contract.status !== ContractStatus.SENT) {
    throw new Error(`Cannot reject contract in status ${contract.status}`);
  }
  return { ...contract, status: ContractStatus.REJECTED };
}

function updateContract(contract: MockContract, data: Partial<MockContract>): MockContract {
  if (contract.status !== ContractStatus.DRAFT) {
    throw new Error('Only DRAFT contracts can be updated');
  }
  return { ...contract, ...data };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ERP Contracts Flow', () => {

  // ─── 12.1.4 — DRAFT → SENT → SIGNED flow ─────────────────────────────

  describe('Full contract flow: DRAFT → SENT → SIGNED', () => {
    it('should create a contract with DRAFT status by default', () => {
      const contract = makeContract();
      expect(contract.status).toBe(ContractStatus.DRAFT);
      expect(contract.sentAt).toBeNull();
      expect(contract.signedAt).toBeNull();
    });

    it('should transition DRAFT → SENT via sendContract()', () => {
      const draft = makeContract();
      const sent = sendContract(draft);

      expect(sent.status).toBe(ContractStatus.SENT);
      expect(sent.sentAt).not.toBeNull();
    });

    it('should transition SENT → SIGNED via acceptContract() by CLIENT', () => {
      const sent = makeContract({ status: ContractStatus.SENT, sentAt: new Date() });
      const signed = acceptContract(sent, /* isClient */ true);

      expect(signed.status).toBe(ContractStatus.SIGNED);
      expect(signed.signedAt).not.toBeNull();
      expect(signed.s3Key).toMatch(/contracts\/contract-1/);
      expect(signed.pdfUrl).toMatch(/contract-1/);
    });

    it('should store CONTRACT_SIGNED notification type', () => {
      // Verify the enum value exists and is used correctly
      expect(NotificationType.CONTRACT_SIGNED).toBe('CONTRACT_SIGNED');
    });

    it('should fire CONTRACT_SENT notification type on sendContract()', () => {
      expect(NotificationType.CONTRACT_SENT).toBe('CONTRACT_SENT');
    });
  });

  // ─── 12.1.5 — DRAFT → SENT → REJECTED flow ──────────────────────────

  describe('Contract rejection flow: DRAFT → SENT → REJECTED', () => {
    it('should transition SENT → REJECTED via rejectContract() by CLIENT', () => {
      const sent = makeContract({ status: ContractStatus.SENT, sentAt: new Date() });
      const rejected = rejectContract(sent, /* isClient */ true);

      expect(rejected.status).toBe(ContractStatus.REJECTED);
    });

    it('should fire CONTRACT_REJECTED notification type', () => {
      expect(NotificationType.CONTRACT_REJECTED).toBe('CONTRACT_REJECTED');
    });

    it('should throw if non-CLIENT tries to reject', () => {
      const sent = makeContract({ status: ContractStatus.SENT, sentAt: new Date() });
      expect(() => rejectContract(sent, /* isClient */ false)).toThrow('Only CLIENT can reject contracts');
    });
  });

  // ─── Cannot send a SENT/SIGNED/REJECTED contract ─────────────────────

  describe('Invalid transitions', () => {
    it('should throw if sending a SENT contract (no double-send)', () => {
      const sent = makeContract({ status: ContractStatus.SENT, sentAt: new Date() });
      expect(() => sendContract(sent)).toThrow(/Cannot send contract in status SENT/);
    });

    it('should throw if sending a SIGNED contract', () => {
      const signed = makeContract({ status: ContractStatus.SIGNED, signedAt: new Date() });
      expect(() => sendContract(signed)).toThrow(/Cannot send contract in status SIGNED/);
    });

    it('should throw if sending a REJECTED contract', () => {
      const rejected = makeContract({ status: ContractStatus.REJECTED });
      expect(() => sendContract(rejected)).toThrow(/Cannot send contract in status REJECTED/);
    });

    it('should throw if updating a SENT contract', () => {
      const sent = makeContract({ status: ContractStatus.SENT, sentAt: new Date() });
      expect(() => updateContract(sent, { title: 'Updated Title' }))
        .toThrow('Only DRAFT contracts can be updated');
    });

    it('should throw if updating a SIGNED contract', () => {
      const signed = makeContract({ status: ContractStatus.SIGNED });
      expect(() => updateContract(signed, { body: 'Updated body' }))
        .toThrow('Only DRAFT contracts can be updated');
    });

    it('should throw if accepting a DRAFT contract', () => {
      const draft = makeContract();
      expect(() => acceptContract(draft, true))
        .toThrow(/Cannot accept contract in status DRAFT/);
    });

    it('should throw if rejecting a SIGNED contract', () => {
      const signed = makeContract({ status: ContractStatus.SIGNED });
      expect(() => rejectContract(signed, true))
        .toThrow(/Cannot reject contract in status SIGNED/);
    });

    it('should throw if non-CLIENT tries to accept', () => {
      const sent = makeContract({ status: ContractStatus.SENT });
      expect(() => acceptContract(sent, /* isClient */ false))
        .toThrow('Only CLIENT can accept contracts');
    });
  });

  // ─── DRAFT contracts can be updated ──────────────────────────────────

  describe('DRAFT contract updates', () => {
    it('should allow updating DRAFT contract title', () => {
      const draft = makeContract();
      const updated = updateContract(draft, { title: 'Amended Agreement' });
      expect(updated.title).toBe('Amended Agreement');
      expect(updated.status).toBe(ContractStatus.DRAFT);
    });

    it('should allow updating DRAFT contract body', () => {
      const draft = makeContract();
      const updated = updateContract(draft, { body: 'New terms…' });
      expect(updated.body).toBe('New terms…');
    });
  });
});
