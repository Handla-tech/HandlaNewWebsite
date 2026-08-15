import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { tasksApi, projectsApi, type TaskInput } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge, Chip, Input } from '@/components/ui';
import { GlassScreen, GradientHeader, GlassCard } from '@/components/glass';
import {
  FormModal,
  Textarea,
  Select,
  DateField,
  ConfirmModal,
  ActionSheet,
  Fab,
  type SelectOption,
  type SheetAction,
} from '@/components/forms';
import { statusColor, prettyStatusT } from '@/lib/statusMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import { useT } from '@/i18n';
import type { PaginatedTasks, Task, TaskStatus } from '@/types';

const STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED'];

const EMPTY: TaskInput = {
  title: '',
  description: '',
  projectId: '',
  assigneeId: '',
  status: 'PENDING',
  dueDate: '',
};

function fmtDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TasksScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const STATUS_OPTIONS: SelectOption[] = STATUSES.map((s) => ({ label: prettyStatusT(s, t), value: s }));
  const qc = useQueryClient();
  const isStaff = useAuthStore((s) => s.isStaff());
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [status, setStatus] = useState<TaskStatus | null>(null);

  const query = useMemo(() => ({ limit: 50, ...(status ? { status } : {}) }), [status]);

  const tasks = useQuery({
    queryKey: ['tasks-mobile', status],
    queryFn: (): Promise<PaginatedTasks> => tasksApi.list(query).then((r) => r.data.data),
  });

  const projectList = useQuery({
    queryKey: ['projects-for-task'],
    enabled: isStaff,
    queryFn: () => projectsApi.list({ limit: 100 }).then((r) => r.data.data.projects),
  });
  const projectOptions: SelectOption[] = (projectList.data ?? []).map((p) => ({
    label: p.title,
    value: p.id,
  }));

  // Assignee picker options. Use the staff-accessible /erp/tasks/assignable-staff
  // endpoint (ADMIN+EMPLOYEE) — NOT usersApi.list, which is ADMIN-only and would
  // 403 for an employee, leaving them unable to assign tasks.
  const staffList = useQuery({
    queryKey: ['assignable-staff'],
    enabled: isStaff,
    queryFn: () => tasksApi.assignableStaff().then((r) => r.data.data.staff),
  });
  const assigneeOptions: SelectOption[] = [
    { label: t('tasks.unassigned'), value: '' },
    ...(staffList.data ?? []).map((u) => ({ label: u.name || u.email, value: u.id })),
  ];

  const rows = tasks.data?.tasks ?? [];

  // form + actions state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskInput>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<Task | null>(null);
  const [deleteFor, setDeleteFor] = useState<Task | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setErr(null);
    setFormOpen(true);
  };
  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description ?? '',
      projectId: task.projectId,
      assigneeId: task.assigneeId ?? '',
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    });
    setErr(null);
    setFormOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload: TaskInput = {
        title: form.title?.trim(),
        description: form.description?.trim() || undefined,
        assigneeId: form.assigneeId?.trim() || undefined,
        status: form.status,
        dueDate: form.dueDate?.trim() || undefined,
        ...(editing ? {} : { projectId: form.projectId }),
      };
      return editing ? tasksApi.update(editing.id, payload) : tasksApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-mobile'] });
      setFormOpen(false);
    },
    onError: (e) => setErr(apiError(e, t('tasks.errors.save'))),
  });
  const del = useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-mobile'] });
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, t('tasks.errors.delete'))),
  });
  const submit = () => {
    if (!form.title?.trim() || form.title.trim().length < 2) return setErr(t('tasks.errors.title'));
    if (!editing && !form.projectId) return setErr(t('tasks.errors.project'));
    setErr(null);
    save.mutate();
  };

  const renderItem = ({ item }: { item: Task }) => {
    const sc = statusColor(item.status);
    const due = fmtDate(item.dueDate);
    const overdue =
      item.dueDate != null &&
      item.status !== 'COMPLETED' &&
      new Date(item.dueDate).getTime() < Date.now();
    const assignee = item.assignee?.name ?? null;
    return (
      <GlassCard
        onPress={() => (isStaff ? setSheetFor(item) : undefined)}
        padded={false}
        style={{ marginBottom: spacing.sm }}
      >
        <View style={{ padding: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons
              name={item.status === 'COMPLETED' ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={sc.color}
            />
            <Text
              style={{ flex: 1, color: colors.text, fontSize: font.md, fontWeight: '700' }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Badge label={prettyStatusT(item.status, t)} color={sc.color} soft={sc.soft} />
          </View>
          {item.project?.title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="folder-outline" size={12} color={colors.textFaint} />
              <Text style={{ color: colors.textFaint, fontSize: font.sm }} numberOfLines={1}>
                {item.project.title}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
            {assignee ? (
              <Text style={{ color: colors.textDim, fontSize: font.xs }}>👤 {assignee}</Text>
            ) : null}
            {due ? (
              <Text
                style={{
                  color: overdue ? '#ef4444' : colors.textDim,
                  fontSize: font.xs,
                  fontWeight: overdue ? '700' : '400',
                }}
              >
                {t('tasks.due', { date: due })}
                {overdue ? t('tasks.overdue') : ''}
              </Text>
            ) : null}
          </View>
        </View>
      </GlassCard>
    );
  };

  return (
    <GlassScreen>
      <GradientHeader title={t('tasks.title')} icon="checkbox-outline" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm }}
        style={{ maxHeight: 44, flexGrow: 0 }}
      >
        <Chip label={t('tasks.all')} active={status === null} onPress={() => setStatus(null)} />
        {STATUSES.map((s) => (
          <Chip key={s} label={prettyStatusT(s, t)} active={status === s} onPress={() => setStatus(s)} />
        ))}
      </ScrollView>

      {tasks.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={tasks.isFetching}
              onRefresh={() => tasks.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="checkbox-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>{t('tasks.empty')}</Text>
            </View>
          }
        />
      )}

      {isStaff ? <Fab onPress={openCreate} /> : null}

      <FormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('tasks.editTask') : t('tasks.newTask')}
        onSubmit={submit}
        submitting={save.isPending}
        error={err ?? undefined}
      >
        <Input
          label={t('tasks.titleLabel')}
          value={form.title}
          onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
          placeholder={t('tasks.titlePlaceholder')}
        />
        <Textarea
          label={t('common.description')}
          value={form.description}
          onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
          placeholder={t('tasks.descPlaceholder')}
        />
        {!editing ? (
          <Select
            label={t('tasks.project')}
            value={form.projectId}
            options={projectOptions}
            onChange={(v) => setForm((f) => ({ ...f, projectId: v }))}
            placeholder={t('tasks.selectProject')}
          />
        ) : null}
        <Select
          label={t('tasks.assignee')}
          value={form.assigneeId}
          options={assigneeOptions}
          onChange={(v) => setForm((f) => ({ ...f, assigneeId: v }))}
          placeholder={t('tasks.unassigned')}
        />
        <Select
          label={t('common.status')}
          value={form.status}
          options={STATUS_OPTIONS}
          onChange={(v) => setForm((f) => ({ ...f, status: v as TaskStatus }))}
        />
        <DateField
          label={t('tasks.dueDate')}
          value={form.dueDate}
          onChange={(v) => setForm((f) => ({ ...f, dueDate: v }))}
        />
      </FormModal>

      <ActionSheet
        visible={!!sheetFor}
        onClose={() => setSheetFor(null)}
        title={sheetFor?.title}
        actions={[
          {
            label: t('common.edit'),
            icon: 'create-outline',
            onPress: () => {
              const task = sheetFor;
              setSheetFor(null);
              if (task) openEdit(task);
            },
          },
          ...(isAdmin
            ? [
                {
                  label: t('common.delete'),
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () => {
                    const task = sheetFor;
                    setSheetFor(null);
                    setDeleteErr(null);
                    if (task) setDeleteFor(task);
                  },
                },
              ]
            : []),
        ] as SheetAction[]}
      />

      <ConfirmModal
        visible={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        onConfirm={() => deleteFor && del.mutate(deleteFor.id)}
        title={t('tasks.deleteTitle')}
        message={t('tasks.deleteMessage', { name: deleteFor?.title ?? '' })}
        confirmLabel={t('common.delete')}
        destructive
        submitting={del.isPending}
        error={deleteErr ?? undefined}
      />
    </GlassScreen>
  );
}
