import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { suppliersApi, type SupplierInput } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge, Input } from '@/components/ui';
import { GlassScreen, GradientHeader, GlassListItem } from '@/components/glass';
import { FormModal, Textarea, SwitchRow, ConfirmModal, ActionSheet, Fab } from '@/components/forms';
import { spacing, radius, font, useTheme } from '@/theme';
import { useT } from '@/i18n';
import type { PaginatedSuppliers, Supplier } from '@/types';

const EMPTY: SupplierInput = {
  name: '',
  company: '',
  email: '',
  phone: '',
  taxId: '',
  address: '',
  notes: '',
  isActive: true,
};

export default function SuppliersScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const isStaff = useAuthStore((s) => s.isStaff());

  const suppliers = useQuery({
    queryKey: ['suppliers-mobile'],
    queryFn: (): Promise<PaginatedSuppliers> =>
      suppliersApi.list({ limit: 50 }).then((r) => r.data.data),
  });
  const rows = suppliers.data?.suppliers ?? [];

  // form state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierInput>(EMPTY);
  const [err, setErr] = useState<string | null>(null);

  // action sheet + delete
  const [sheetFor, setSheetFor] = useState<Supplier | null>(null);
  const [deleteFor, setDeleteFor] = useState<Supplier | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setErr(null);
    setFormOpen(true);
  };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      company: s.company ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      taxId: s.taxId ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
      isActive: s.isActive !== false,
    });
    setErr(null);
    setFormOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload: SupplierInput = {
        name: form.name?.trim(),
        company: form.company?.trim() || null,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        taxId: form.taxId?.trim() || null,
        address: form.address?.trim() || null,
        notes: form.notes?.trim() || null,
        isActive: form.isActive,
      };
      return editing ? suppliersApi.update(editing.id, payload) : suppliersApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers-mobile'] });
      setFormOpen(false);
    },
    onError: (e) => setErr(apiError(e, t('suppliers.errors.save'))),
  });

  const del = useMutation({
    mutationFn: (id: string) => suppliersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers-mobile'] });
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, t('suppliers.errors.delete'))),
  });

  const submit = () => {
    if (!form.name?.trim()) {
      setErr(t('suppliers.errors.name'));
      return;
    }
    setErr(null);
    save.mutate();
  };

  const renderItem = ({ item }: { item: Supplier }) => (
    <GlassListItem
      onPress={() => (isStaff ? setSheetFor(item) : undefined)}
      leading={
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="business-outline" size={20} color={colors.accent} />
        </View>
      }
      title={item.name}
      subtitle={item.company ?? undefined}
      meta={item.email ?? undefined}
      right={
        item.isActive === false ? (
          <Badge label={t('common.inactive')} color="#9ca3af" soft="rgba(156,163,175,0.15)" />
        ) : (
          <Badge label={t('common.active')} color="#22c55e" soft="rgba(34,197,94,0.15)" />
        )
      }
    />
  );

  return (
    <GlassScreen>
      <GradientHeader title={t('suppliers.title')} icon="business-outline" />
      {suppliers.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 96 }}
          refreshControl={
            <RefreshControl
              refreshing={suppliers.isFetching}
              onRefresh={() => suppliers.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="business-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>{t('suppliers.empty')}</Text>
            </View>
          }
        />
      )}

      {isStaff ? <Fab onPress={openCreate} /> : null}

      {/* Create / Edit */}
      <FormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('suppliers.editSupplier') : t('suppliers.newSupplier')}
        onSubmit={submit}
        submitting={save.isPending}
        error={err}
      >
        <Input
          label={t('suppliers.nameRequired')}
          value={form.name ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
          placeholder={t('suppliers.namePlaceholder')}
        />
        <Input
          label={t('clients.company')}
          value={form.company ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, company: v }))}
          placeholder={t('suppliers.companyPlaceholder')}
        />
        <Input
          label={t('common.email')}
          value={form.email ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
          placeholder={t('suppliers.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label={t('suppliers.phone')}
          value={form.phone ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
          placeholder={t('suppliers.phonePlaceholder')}
          keyboardType="phone-pad"
        />
        <Input
          label={t('suppliers.taxId')}
          value={form.taxId ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, taxId: v }))}
          placeholder={t('suppliers.taxIdPlaceholder')}
        />
        <Textarea
          label={t('suppliers.address')}
          value={form.address ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
          placeholder={t('suppliers.addressPlaceholder')}
        />
        <Textarea
          label={t('common.notes')}
          value={form.notes ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
          placeholder={t('suppliers.notesPlaceholder')}
        />
        <SwitchRow
          label={t('common.active')}
          value={form.isActive !== false}
          onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
        />
      </FormModal>

      {/* Row actions */}
      <ActionSheet
        visible={!!sheetFor}
        onClose={() => setSheetFor(null)}
        title={sheetFor?.name}
        actions={[
          { label: t('common.edit'), icon: 'create-outline', onPress: () => sheetFor && openEdit(sheetFor) },
          ...(isAdmin
            ? [
                {
                  label: t('common.delete'),
                  icon: 'trash-outline' as const,
                  destructive: true,
                  onPress: () => {
                    setDeleteErr(null);
                    setDeleteFor(sheetFor);
                  },
                },
              ]
            : []),
        ]}
      />

      {/* Delete confirm */}
      <ConfirmModal
        visible={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        onConfirm={() => deleteFor && del.mutate(deleteFor.id)}
        title={t('suppliers.deleteTitle')}
        message={t('suppliers.deleteMessage', { name: deleteFor?.name ?? '' })}
        confirmLabel={t('common.delete')}
        destructive
        submitting={del.isPending}
        error={deleteErr}
      />
    </GlassScreen>
  );
}
