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
import { statusColor, prettyStatusT } from '@/lib/statusMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import { useT } from '@/i18n';
import type { PaginatedClients, Client } from '@/types';

const STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'CHURNED'];

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
  const { t } = useT();
  const { colors } = useTheme();
  const STATUS_OPTIONS: SelectOption[] = STATUS_VALUES.map((v) => ({
    label: t(`status.${v}`),
    value: v,
  }));
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
        // Editing the linked user's name/email hits the ADMIN-only /users
        // endpoint, so only attempt it as an admin. Employees can still update
        // the client-record fields (company/status/notes) via /erp/clients,
        // which they're allowed to do — so their edits no longer 403.
        if (isAdmin && editing.userId && (form.name.trim() || form.email.trim())) {
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
      // Create: provision the CLIENT user + client record atomically in one
      // call. This staff-accessible endpoint (ADMIN+EMPLOYEE) replaces the old
      // create-user → poll → patch dance and does NOT touch the ADMIN-only
      // /users controller, so employees can onboard clients too.
      await clientsApi.provision({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        ...(form.company.trim() ? { company: form.company.trim() } : {}),
        ...(form.status ? { status: form.status } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients-mobile'] });
      setFormOpen(false);
    },
    onError: (e) => setErr(apiError(e, t('clients.errors.save'))),
  });

  const del = useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients-mobile'] });
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, t('clients.errors.delete'))),
  });

  const submit = () => {
    if (!editing) {
      if (form.name.trim().length < 2) return setErr(t('clients.errors.name'));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        return setErr(t('clients.errors.email'));
      if (
        form.password.length < 8 ||
        !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)
      )
        return setErr(t('clients.errors.password'));
    }
    setErr(null);
    save.mutate();
  };

  const renderItem = ({ item }: { item: Client }) => {
    const name = item.user?.name ?? item.company ?? t('clients.fallbackName');
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
              label={prettyStatusT(item.status, t)}
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
      <GradientHeader title={t('clients.title')} icon="people-circle-outline" />
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
              <Text style={{ color: colors.textFaint }}>{t('clients.empty')}</Text>
            </View>
          }
        />
      )}

      {/* Onboarding a client now uses POST /erp/clients/provision, which is
          staff-accessible (ADMIN+EMPLOYEE) and creates the CLIENT user + record
          atomically — no ADMIN-only /users dependency. So employees can create
          clients too, and the FAB is shown to all staff. */}
      {isStaff ? <Fab onPress={openCreate} /> : null}

      <FormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('clients.editClient') : t('clients.newClient')}
        subtitle={
          editing ? undefined : t('clients.newSubtitle')
        }
        onSubmit={submit}
        submitting={save.isPending}
        error={err ?? undefined}
      >
        {/* On CREATE, name & email feed the staff-accessible provision endpoint,
            so all staff see them. On EDIT they belong to the linked user account
            (only mutable via the ADMIN-only /users endpoint), so hide them for a
            non-admin editor — employees edit company/status/notes only. */}
        {(!editing || isAdmin) && (
          <>
            <Input
              label={t('clients.fullName')}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder={t('clients.fullNamePlaceholder')}
              autoCapitalize="words"
            />
            <Input
              label={t('common.email')}
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder={t('clients.emailPlaceholder')}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </>
        )}
        {!editing ? (
          <Input
            label={t('clients.tempPassword')}
            value={form.password}
            onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
            placeholder={t('clients.tempPasswordPlaceholder')}
            autoCapitalize="none"
            secureTextEntry
          />
        ) : null}
        <Input
          label={t('clients.company')}
          value={form.company}
          onChangeText={(v) => setForm((f) => ({ ...f, company: v }))}
          placeholder={t('common.optional')}
        />
        <Select
          label={t('common.status')}
          value={form.status}
          options={STATUS_OPTIONS}
          onChange={(v) => setForm((f) => ({ ...f, status: v }))}
        />
        <Textarea
          label={t('common.notes')}
          value={form.notes}
          onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
          placeholder={t('clients.notesPlaceholder')}
        />
      </FormModal>

      <ActionSheet
        visible={!!sheetFor}
        onClose={() => setSheetFor(null)}
        title={sheetFor?.user?.name ?? sheetFor?.company ?? t('clients.fallbackName')}
        actions={[
          {
            label: t('common.edit'),
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
                  label: t('common.delete'),
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
        title={t('clients.deleteTitle')}
        message={t('clients.deleteMessage', { name: deleteFor?.user?.name ?? deleteFor?.company ?? t('clients.deleteFallback') })}
        confirmLabel={t('common.delete')}
        destructive
        submitting={del.isPending}
        error={deleteErr ?? undefined}
      />
    </GlassScreen>
  );
}
