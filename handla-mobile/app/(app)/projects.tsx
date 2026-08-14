import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { projectsApi, clientsApi, type ProjectInput } from '@/lib/endpoints';
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
import { statusColor, prettyStatus } from '@/lib/statusMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import type { PaginatedProjects, Project, ProjectStatus } from '@/types';

const STATUSES: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const STATUS_OPTIONS: SelectOption[] = STATUSES.map((s) => ({ label: prettyStatus(s), value: s }));

const EMPTY: ProjectInput = { title: '', description: '', clientId: '', status: 'PLANNING', startDate: '', endDate: '' };

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProjectsScreen() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const isClient = useAuthStore((s) => s.isClient());
  const isStaff = useAuthStore((s) => s.isStaff());
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [status, setStatus] = useState<ProjectStatus | null>(null);

  const query = useMemo(() => ({ limit: 50, ...(status ? { status } : {}) }), [status]);

  const projects = useQuery({
    queryKey: ['projects-mobile', status],
    queryFn: (): Promise<PaginatedProjects> => {
      const req = isClient ? projectsApi.mine(query) : projectsApi.list(query);
      return req.then((r) => r.data.data);
    },
  });

  const clientList = useQuery({
    queryKey: ['clients-for-project'],
    enabled: isStaff,
    queryFn: () => clientsApi.list({ limit: 100 }).then((r) => r.data.data.clients),
  });
  const clientOptions: SelectOption[] = (clientList.data ?? []).map((c) => ({
    label: c.user?.name || c.company || c.user?.email || c.id.slice(0, 8),
    value: c.id,
  }));

  const rows = projects.data?.projects ?? [];

  // form + actions state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectInput>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<Project | null>(null);
  const [deleteFor, setDeleteFor] = useState<Project | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setErr(null);
    setFormOpen(true);
  };
  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description ?? '',
      clientId: p.clientId,
      status: p.status as ProjectStatus,
      startDate: p.startDate ? p.startDate.slice(0, 10) : '',
      endDate: p.endDate ? p.endDate.slice(0, 10) : '',
    });
    setErr(null);
    setFormOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload: ProjectInput = {
        title: form.title?.trim(),
        description: form.description?.trim() || undefined,
        status: form.status,
        startDate: form.startDate?.trim() || undefined,
        endDate: form.endDate?.trim() || undefined,
        ...(editing ? {} : { clientId: form.clientId }),
      };
      return editing ? projectsApi.update(editing.id, payload) : projectsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects-mobile'] });
      setFormOpen(false);
    },
    onError: (e) => setErr(apiError(e, 'Failed to save project')),
  });
  const del = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects-mobile'] });
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, 'Failed to delete project')),
  });
  const submit = () => {
    if (!form.title?.trim() || form.title.trim().length < 2) return setErr('Title must be at least 2 characters.');
    if (!editing && !form.clientId) return setErr('Client is required.');
    setErr(null);
    save.mutate();
  };

  const renderItem = ({ item }: { item: Project }) => {
    const sc = statusColor(item.status);
    const clientName = item.client?.user?.name ?? item.client?.company ?? '';
    return (
      <GlassCard
        onPress={() => (isStaff ? setSheetFor(item) : undefined)}
        padded={false}
        style={{ marginBottom: spacing.sm }}
      >
        <View style={{ padding: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="folder-open-outline" size={18} color={colors.accent} />
            <Text
              style={{ flex: 1, color: colors.text, fontSize: font.md, fontWeight: '700' }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Badge label={prettyStatus(item.status)} color={sc.color} soft={sc.soft} />
          </View>
          {clientName ? (
            <Text style={{ color: colors.textFaint, fontSize: font.sm, marginTop: 4 }} numberOfLines={1}>
              {clientName}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
            <Text style={{ color: colors.textDim, fontSize: font.xs }}>
              Start: {fmtDate(item.startDate)}
            </Text>
            <Text style={{ color: colors.textDim, fontSize: font.xs }}>
              End: {fmtDate(item.endDate)}
            </Text>
          </View>
        </View>
      </GlassCard>
    );
  };

  return (
    <GlassScreen>
      <GradientHeader title="Projects" icon="folder-open-outline" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm }}
        style={{ maxHeight: 44, flexGrow: 0 }}
      >
        <Chip label="All" active={status === null} onPress={() => setStatus(null)} />
        {STATUSES.map((s) => (
          <Chip
            key={s}
            label={prettyStatus(s)}
            active={status === s}
            onPress={() => setStatus(s)}
          />
        ))}
      </ScrollView>

      {projects.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={projects.isFetching}
              onRefresh={() => projects.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="folder-open-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>No projects found.</Text>
            </View>
          }
        />
      )}

      {isStaff ? <Fab onPress={openCreate} /> : null}

      <FormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Project' : 'New Project'}
        onSubmit={submit}
        submitting={save.isPending}
        error={err ?? undefined}
      >
        <Input
          label="Title"
          value={form.title}
          onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
          placeholder="Project title"
        />
        <Textarea
          label="Description"
          value={form.description}
          onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
          placeholder="Optional description"
        />
        {!editing ? (
          <Select
            label="Client"
            value={form.clientId}
            options={clientOptions}
            onChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
            placeholder="Select a client"
          />
        ) : null}
        <Select
          label="Status"
          value={form.status}
          options={STATUS_OPTIONS}
          onChange={(v) => setForm((f) => ({ ...f, status: v as ProjectStatus }))}
        />
        <DateField
          label="Start date"
          value={form.startDate}
          onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
        />
        <DateField
          label="End date"
          value={form.endDate}
          onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
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
              const p = sheetFor;
              setSheetFor(null);
              if (p) openEdit(p);
            },
          },
          ...(isAdmin
            ? [
                {
                  label: 'Delete',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () => {
                    const p = sheetFor;
                    setSheetFor(null);
                    setDeleteErr(null);
                    if (p) setDeleteFor(p);
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
        title="Delete Project"
        message={`Delete "${deleteFor?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        submitting={del.isPending}
        error={deleteErr ?? undefined}
      />
    </GlassScreen>
  );
}
