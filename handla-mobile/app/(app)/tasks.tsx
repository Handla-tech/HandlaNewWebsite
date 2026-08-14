import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView, Pressable } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tasksApi, projectsApi, usersApi, type TaskInput } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Title, Loading, Badge, Chip, Input } from '@/components/ui';
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
import { statusColor, prettyStatus } from '@/lib/statusMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import type { PaginatedTasks, Task, TaskStatus } from '@/types';

const STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED'];
const STATUS_OPTIONS: SelectOption[] = STATUSES.map((s) => ({ label: prettyStatus(s), value: s }));

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
  const { colors } = useTheme();
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

  const staffList = useQuery({
    queryKey: ['staff-for-task'],
    enabled: isStaff,
    queryFn: () => usersApi.list({ limit: 100 }).then((r) => r.data.data.users),
  });
  const assigneeOptions: SelectOption[] = [
    { label: 'Unassigned', value: '' },
    ...(staffList.data ?? [])
      .filter((u) => u.role === 'ADMIN' || u.role === 'EMPLOYEE')
      .map((u) => ({ label: u.name || u.email, value: u.id })),
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
  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description ?? '',
      projectId: t.projectId,
      assigneeId: t.assigneeId ?? '',
      status: t.status,
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : '',
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
    onError: (e) => setErr(apiError(e, 'Failed to save task')),
  });
  const del = useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-mobile'] });
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, 'Failed to delete task')),
  });
  const submit = () => {
    if (!form.title?.trim() || form.title.trim().length < 2) return setErr('Title must be at least 2 characters.');
    if (!editing && !form.projectId) return setErr('Project is required.');
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
      <Pressable
        onPress={() => isStaff && setSheetFor(item)}
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        }}
      >
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
          <Badge label={prettyStatus(item.status)} color={sc.color} soft={sc.soft} />
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
              Due {due}
              {overdue ? ' • overdue' : ''}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Tasks</Title>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm }}
        style={{ maxHeight: 44, flexGrow: 0 }}
      >
        <Chip label="All" active={status === null} onPress={() => setStatus(null)} />
        {STATUSES.map((s) => (
          <Chip key={s} label={prettyStatus(s)} active={status === s} onPress={() => setStatus(s)} />
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
              <Text style={{ color: colors.textFaint }}>No tasks found.</Text>
            </View>
          }
        />
      )}

      {isStaff ? <Fab onPress={openCreate} /> : null}

      <FormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Task' : 'New Task'}
        onSubmit={submit}
        submitting={save.isPending}
        error={err ?? undefined}
      >
        <Input
          label="Title"
          value={form.title}
          onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
          placeholder="Task title"
        />
        <Textarea
          label="Description"
          value={form.description}
          onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
          placeholder="Optional description"
        />
        {!editing ? (
          <Select
            label="Project"
            value={form.projectId}
            options={projectOptions}
            onChange={(v) => setForm((f) => ({ ...f, projectId: v }))}
            placeholder="Select a project"
          />
        ) : null}
        <Select
          label="Assignee"
          value={form.assigneeId}
          options={assigneeOptions}
          onChange={(v) => setForm((f) => ({ ...f, assigneeId: v }))}
          placeholder="Unassigned"
        />
        <Select
          label="Status"
          value={form.status}
          options={STATUS_OPTIONS}
          onChange={(v) => setForm((f) => ({ ...f, status: v as TaskStatus }))}
        />
        <DateField
          label="Due date"
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
            label: 'Edit',
            icon: 'create-outline',
            onPress: () => {
              const t = sheetFor;
              setSheetFor(null);
              if (t) openEdit(t);
            },
          },
          ...(isAdmin
            ? [
                {
                  label: 'Delete',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () => {
                    const t = sheetFor;
                    setSheetFor(null);
                    setDeleteErr(null);
                    if (t) setDeleteFor(t);
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
        title="Delete Task"
        message={`Delete "${deleteFor?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        submitting={del.isPending}
        error={deleteErr ?? undefined}
      />
    </SafeAreaView>
  );
}
