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
    onError: (e) => setErr(apiError(e, 'Failed to save supplier')),
  });

  const del = useMutation({
    mutationFn: (id: string) => suppliersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers-mobile'] });
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, 'Failed to delete supplier')),
  });

  const submit = () => {
    if (!form.name?.trim()) {
      setErr('Name is required.');
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
          <Badge label="Inactive" color="#9ca3af" soft="rgba(156,163,175,0.15)" />
        ) : (
          <Badge label="Active" color="#22c55e" soft="rgba(34,197,94,0.15)" />
        )
      }
    />
  );

  return (
    <GlassScreen>
      <GradientHeader title="Suppliers" icon="business-outline" />
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
              <Text style={{ color: colors.textFaint }}>No suppliers yet.</Text>
            </View>
          }
        />
      )}

      {isStaff ? <Fab onPress={openCreate} /> : null}

      {/* Create / Edit */}
      <FormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Supplier' : 'New Supplier'}
        onSubmit={submit}
        submitting={save.isPending}
        error={err}
      >
        <Input
          label="Name *"
          value={form.name ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
          placeholder="Supplier name"
        />
        <Input
          label="Company"
          value={form.company ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, company: v }))}
          placeholder="Company"
        />
        <Input
          label="Email"
          value={form.email ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Phone"
          value={form.phone ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
          placeholder="Phone"
          keyboardType="phone-pad"
        />
        <Input
          label="Tax ID"
          value={form.taxId ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, taxId: v }))}
          placeholder="Tax ID"
        />
        <Textarea
          label="Address"
          value={form.address ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
          placeholder="Address"
        />
        <Textarea
          label="Notes"
          value={form.notes ?? ''}
          onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
          placeholder="Internal notes"
        />
        <SwitchRow
          label="Active"
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
          { label: 'Edit', icon: 'create-outline', onPress: () => sheetFor && openEdit(sheetFor) },
          ...(isAdmin
            ? [
                {
                  label: 'Delete',
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
        title="Delete Supplier"
        message={`Permanently delete "${deleteFor?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        submitting={del.isPending}
        error={deleteErr}
      />
    </GlassScreen>
  );
}
