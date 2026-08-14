import { AiStateService } from '../services/ai-state.service';
import { ConversationAiState } from '../entities/conversation-ai-state.entity';
import { AiControlMode, LeadStatus } from '../../../common/enums';

/**
 * Minimal in-memory repository double implementing just the methods
 * AiStateService uses (findOne / create / save).
 */
function makeRepo() {
  const store = new Map<string, ConversationAiState>();
  return {
    store,
    findOne: jest.fn(async ({ where }: any) => store.get(where.conversationId) ?? null),
    create: jest.fn((partial: Partial<ConversationAiState>) => {
      const row = {
        id: 'state-' + partial.conversationId,
        conversationId: partial.conversationId!,
        controlMode: partial.controlMode ?? AiControlMode.AI,
        takenOverBy: null,
        takenOverAt: null,
        needsHuman: false,
        escalationReason: null,
        leadStatus: partial.leadStatus ?? LeadStatus.NEW,
        leadData: null,
        missingFields: null,
        runningSummary: null,
        lastHandledMessageId: null,
        aiMessageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ConversationAiState;
      return row;
    }),
    save: jest.fn(async (row: ConversationAiState) => {
      store.set(row.conversationId, row);
      return row;
    }),
  };
}

describe('AiStateService', () => {
  it('getOrCreate creates a row then returns the same row', async () => {
    const repo = makeRepo();
    const svc = new AiStateService(repo as any);

    const first = await svc.getOrCreate('conv1');
    expect(first.controlMode).toBe(AiControlMode.AI);
    expect(repo.save).toHaveBeenCalledTimes(1);

    const second = await svc.getOrCreate('conv1');
    expect(second.conversationId).toBe('conv1');
    // no second save — row already existed
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('takeOver mutes the bot immediately and records who/when', async () => {
    const repo = makeRepo();
    const svc = new AiStateService(repo as any);

    const state = await svc.takeOver('conv1', 'staff-9', 'handling personally');
    expect(state.controlMode).toBe(AiControlMode.HUMAN);
    expect(state.takenOverBy).toBe('staff-9');
    expect(state.takenOverAt).toBeInstanceOf(Date);
    expect(state.needsHuman).toBe(false);
    expect(svc.isBotActive(state)).toBe(false);
  });

  it('returnToAi restores bot control and clears takeover metadata', async () => {
    const repo = makeRepo();
    const svc = new AiStateService(repo as any);

    await svc.takeOver('conv1', 'staff-9');
    const state = await svc.returnToAi('conv1');
    expect(state.controlMode).toBe(AiControlMode.AI);
    expect(state.takenOverBy).toBeNull();
    expect(state.takenOverAt).toBeNull();
    expect(svc.isBotActive(state)).toBe(true);
  });
});
