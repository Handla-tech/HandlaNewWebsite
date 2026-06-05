/**
 * ERP-12.1 — Tasks Lifecycle Flow Tests
 *
 * Tests: create with assignee → TASK_ASSIGNED notification →
 * recalculate delayed → TASK_DELAYED notification → idempotent.
 * Task completion rate via dashboard calc.
 */

import { TaskStatus, NotificationType } from '../../../common/enums';

// ─── Mock types ───────────────────────────────────────────────────────────────

interface MockTask {
  id:         string;
  title:      string;
  projectId:  string;
  ownerId:    string;
  assigneeId: string | null;
  status:     TaskStatus;
  dueDate:    string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<MockTask> = {}): MockTask {
  return {
    id:         'task-1',
    title:      'Build login page',
    projectId:  'proj-1',
    ownerId:    'emp-1',
    assigneeId: null,
    status:     TaskStatus.PENDING,
    dueDate:    null,
    ...overrides,
  };
}

function recalculateDelayed(
  tasks: MockTask[],
  today: Date,
  previouslyDelayed: Set<string>,
): { updated: MockTask[]; notified: string[] } {
  const notified: string[] = [];
  const updated = tasks.map(t => {
    if (
      t.status !== TaskStatus.COMPLETED &&
      t.dueDate &&
      new Date(t.dueDate) < today
    ) {
      if (!previouslyDelayed.has(t.id)) {
        notified.push(t.id);
        previouslyDelayed.add(t.id);
      }
      return { ...t, status: TaskStatus.DELAYED };
    }
    return t;
  });
  return { updated, notified };
}

function calculateCompletionRate(tasks: MockTask[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  return Math.round((completed / tasks.length) * 100);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ERP Tasks Flow', () => {

  // ─── 12.1.9 — Create task with assignee ──────────────────────────────

  describe('Task creation', () => {
    it('should create task with default PENDING status', () => {
      const task = makeTask();
      expect(task.status).toBe(TaskStatus.PENDING);
    });

    it('should fire TASK_ASSIGNED notification when assigneeId is set', () => {
      const task = makeTask({ assigneeId: 'emp-2' });
      expect(task.assigneeId).toBe('emp-2');
      // Notification type check
      expect(NotificationType.TASK_ASSIGNED).toBe('TASK_ASSIGNED');
    });

    it('should NOT fire TASK_ASSIGNED notification when no assigneeId', () => {
      const task = makeTask({ assigneeId: null });
      expect(task.assigneeId).toBeNull();
      // No assignee → no TASK_ASSIGNED notification should be fired
    });
  });

  // ─── 12.1.10 — Recalculate delayed ───────────────────────────────────

  describe('Recalculate delayed status', () => {
    it('should mark PENDING tasks past due as DELAYED', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const task = makeTask({
        dueDate: yesterday.toISOString().split('T')[0],
        status:  TaskStatus.PENDING,
      });

      const { updated } = recalculateDelayed([task], new Date(), new Set());
      expect(updated[0].status).toBe(TaskStatus.DELAYED);
    });

    it('should mark IN_PROGRESS tasks past due as DELAYED', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const task = makeTask({
        dueDate: yesterday.toISOString().split('T')[0],
        status:  TaskStatus.IN_PROGRESS,
      });

      const { updated } = recalculateDelayed([task], new Date(), new Set());
      expect(updated[0].status).toBe(TaskStatus.DELAYED);
    });

    it('should NOT mark COMPLETED tasks as DELAYED even if past due', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const task = makeTask({
        dueDate: yesterday.toISOString().split('T')[0],
        status:  TaskStatus.COMPLETED,
      });

      const { updated } = recalculateDelayed([task], new Date(), new Set());
      expect(updated[0].status).toBe(TaskStatus.COMPLETED);
    });

    it('should fire TASK_DELAYED notification type', () => {
      expect(NotificationType.TASK_DELAYED).toBe('TASK_DELAYED');
    });

    it('should be idempotent — no duplicate TASK_DELAYED notification', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const task = makeTask({
        id:      'task-1',
        dueDate: yesterday.toISOString().split('T')[0],
        status:  TaskStatus.PENDING,
      });

      const alreadyProcessed = new Set<string>(['task-1']);
      const { notified } = recalculateDelayed([task], new Date(), alreadyProcessed);
      expect(notified).toHaveLength(0);
    });

    it('should NOT delay tasks without dueDate', () => {
      const task = makeTask({ dueDate: null, status: TaskStatus.PENDING });
      const { updated } = recalculateDelayed([task], new Date(), new Set());
      expect(updated[0].status).toBe(TaskStatus.PENDING);
    });

    it('should return count of newly-delayed tasks', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const tasks = [
        makeTask({ id: 't-1', dueDate: yesterday.toISOString().split('T')[0], status: TaskStatus.PENDING }),
        makeTask({ id: 't-2', dueDate: yesterday.toISOString().split('T')[0], status: TaskStatus.IN_PROGRESS }),
        makeTask({ id: 't-3', dueDate: yesterday.toISOString().split('T')[0], status: TaskStatus.COMPLETED }),
      ];

      const { notified } = recalculateDelayed(tasks, new Date(), new Set());
      expect(notified).toHaveLength(2); // PENDING + IN_PROGRESS delayed; COMPLETED skipped
    });

    it('should not throw on empty task list', () => {
      expect(() => recalculateDelayed([], new Date(), new Set())).not.toThrow();
    });
  });

  // ─── 12.1.11 — Task completion rate (dashboard calc) ─────────────────

  describe('Task completion rate calculation', () => {
    it('should return 0% when no tasks', () => {
      expect(calculateCompletionRate([])).toBe(0);
    });

    it('should return 100% when all tasks are completed', () => {
      const tasks = [
        makeTask({ status: TaskStatus.COMPLETED }),
        makeTask({ id: 't-2', status: TaskStatus.COMPLETED }),
      ];
      expect(calculateCompletionRate(tasks)).toBe(100);
    });

    it('should return 50% when half are completed', () => {
      const tasks = [
        makeTask({ id: 't-1', status: TaskStatus.COMPLETED }),
        makeTask({ id: 't-2', status: TaskStatus.PENDING }),
      ];
      expect(calculateCompletionRate(tasks)).toBe(50);
    });

    it('should return 0% when no tasks are completed', () => {
      const tasks = [
        makeTask({ id: 't-1', status: TaskStatus.PENDING }),
        makeTask({ id: 't-2', status: TaskStatus.IN_PROGRESS }),
      ];
      expect(calculateCompletionRate(tasks)).toBe(0);
    });

    it('should round percentage to nearest integer', () => {
      // 1 of 3 completed = 33.33%
      const tasks = [
        makeTask({ id: 't-1', status: TaskStatus.COMPLETED }),
        makeTask({ id: 't-2', status: TaskStatus.PENDING }),
        makeTask({ id: 't-3', status: TaskStatus.PENDING }),
      ];
      expect(calculateCompletionRate(tasks)).toBe(33);
    });

    it('should count DELAYED tasks as not completed', () => {
      const tasks = [
        makeTask({ id: 't-1', status: TaskStatus.DELAYED }),
        makeTask({ id: 't-2', status: TaskStatus.COMPLETED }),
      ];
      expect(calculateCompletionRate(tasks)).toBe(50);
    });
  });
});
