import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { clientsApi, usersApi } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge, Input } from '@/components/ui';
import { GlassScreen, GradientHeader, GlassListItem, Avatar } from '@/components/glass';
import {
  FormModal,
  Textarea,
  Select,
  ConfirmModal,
  ActionSheet,
  Fab,
  type SelectOption,
  type SheetAction,
} from '@/components/forms';
import { statusColor, prettyStatus } from '@/lib/statusMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import type { PaginatedClients, Client } from '@/types';

const STATUS_OPTIONS: SelectOption[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
  { label: 'Churned', value: 'CHURNED' },
];

interface ClientForm {
  name: string;
  email: string;
  password: string;
  company: string;
  status: string;
  notes: string;
}
const EMPTY: ClientForm = {
  name: '',
  email: '',
  password: '',
  company: '',
  status: 'ACTIVE',
  notes: '',
};

export default function ClientsScreen() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const isStaff = useAuthStore((s) => s.isStaff());
  const isAdmin = useAuthStore((s) => s.isAdmin());

  const clients = useQuery({
    queryKey: ['clients-mobile'],
    queryFn: (): Promise<PaginatedClients> =>
      clientsApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const rows = clients.data?.clients ?? [];

  // form + actions state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<Client | null>(null);
  const [deleteFor, setDeleteFor] = useState<Client | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setErr(null);
    setFormOpen(true);
  };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      name: c.user?.name ?? '',
      email: c.user?.email ?? '',
      password: '',
      company: c.company ?? '',
      status: c.status ?? 'ACTIVE',
      notes: '',
    });
    setErr(null);
    setFormOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        // Update the linked user's name/email (best-effort) + client fields.
        if (editing.userId && (form.name.trim() || form.email.trim())) {
          await usersApi.update(editing.userId, {
            ...(form.name.trim() ? { name: form.name.trim() } : {}),
            ...(form.email.trim() ? { email: form.email.trim() } : {}),
          });
        }
        await clientsApi.update(editing.id, {
          company: form.company.trim() || undefined,
          status: form.status,
          notes: form.notes.trim() || undefined,
        });
        return;
      }
      // Create: make a CLIENT user (backend auto-creates the client record),
      // then patch company/status/notes onto the new client record.
      const userRes = await usersApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: 'CLIENT',
      });
      const newUserId = userRes.data?.data?.user?.id;
      if (!newUserId) throw new Error('User creation did not return an ID');
      // Give the backend a moment to create the client record, then locate it.
      await new Promise((res) => setTimeout(res, 400));
      let list = await clientsApi.list({ limit: 20, page: 1 });
      let match = list.data.data.clients.find((c) => c.userId === newUserId);
      if (!match) {
        await new Promise((res) => setTimeout(res, 600));
        list = await clientsApi.list({ limit: 20, page: 1 });
        match = list.data.data.clients.find((c) => c.userId === newUserId);
      }
      if (match && (form.company.trim() || form.status || form.notes.trim())) {
        await clientsApi.update(match.id, {
          ...(form.company.trim() ? { company: form.company.trim() } : {}),
          ...(form.status ? { status: form.status } : {}),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients-mobile'] });
      setFormOpen(false);
    },
    onError: (e) => setErr(apiError(e, 'Failed to save client')),
  });

  const del = useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients-mobile'] });
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, 'Failed to delete client')),
  });

  const submit = () => {
    if (!editing) {
      if (form.name.trim().length < 2) return setErr('Name must be at least 2 characters.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        return setErr('A valid email is required.');
      if (
        form.password.length < 8 ||
        !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)
      )
        return setErr('Password: min 8 chars with uppercase, lowercase and a number.');
    }
    setErr(null);
    save.mutate();
  };

  const renderItem = ({ item }: { item: Client }) => {
    const name = item.user?.name ?? item.company ?? 'Client';
    const email = item.user?.email ?? '';
    return (
      <GlassListItem
        onPress={() => (isStaff ? setSheetFor(item) : undefined)}
        leading={<Avatar name={name} size={42} />}
        title={name}
        subtitle={item.company ?? undefined}
        meta={email || undefined}
        right={
          item.status ? (
            <Badge
              label={prettyStatus(item.status)}
              color={statusColor(item.status).color}
              soft={statusColor(item.status).soft}
            />
          ) : undefined
        }
      />
    );
  };

  return (
    <GlassScreen>
      <GradientHeader title="Clients" icon="people-circle-outline" />
      {clients.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={clients.isFetching}
              onRefresh={() => clients.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="people-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>No clients yet.</Text>
            </View>
          }
        />
      )}

      {isStaff ? <Fab onPress={openCreate} /> : null}

      <FormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Client' : 'New Client'}
        subtitle={
          editing ? undefined : 'A new CLIENT login is created for this person.'
        }
        onSubmit={submit}
        submitting={save.isPending}
        error={err ?? undefined}
      >
        <Input
          label="Full name"
          value={form.name}
          onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
          placeholder="Jane Smith"
          autoCapitalize="words"
        />
        <Input
          label="Email"
          value={form.email}
          onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
          placeholder="jane@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {!editing ? (
          <Input
            label="Temporary password"
            value={form.password}
            onChangeText={(t) => setForm((f) => ({ ...f, password: t }))}
            placeholder="Min 8 chars, mixed case + number"
            autoCapitalize="none"
            secureTextEntry
          />
        ) : null}
        <Input
          label="Company"
          value={form.company}
          onChangeText={(t) => setForm((f) => ({ ...f, company: t }))}
          placeholder="Optional"
        />
        <Select
          label="Status"
          value={form.status}
          options={STATUS_OPTIONS}
          onChange={(v) => setForm((f) => ({ ...f, status: v }))}
        />
        <Textarea
          label="Notes"
          value={form.notes}
          onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
          placeholder="Internal notes (optional)"
        />
      </FormModal>

      <ActionSheet
        visible={!!sheetFor}
        onClose={() => setSheetFor(null)}
        title={sheetFor?.user?.name ?? sheetFor?.company ?? 'Client'}
        actions={[
          {
            label: 'Edit',
            icon: 'create-outline',
            onPress: () => {
              const c = sheetFor;
              setSheetFor(null);
              if (c) openEdit(c);
            },
          },
          ...(isAdmin
            ? [
                {
                  label: 'Delete',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () => {
                    const c = sheetFor;
                    setSheetFor(null);
                    setDeleteErr(null);
                    if (c) setDeleteFor(c);
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
        title="Delete Client"
        message={`Delete "${deleteFor?.user?.name ?? deleteFor?.company ?? 'this client'}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        submitting={del.isPending}
        error={deleteErr ?? undefined}
      />
    </GlassScreen>
  );
}
