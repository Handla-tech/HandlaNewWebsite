import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Image } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { websiteProductsApi, type WebsiteProductInput } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Loading, Input } from '@/components/ui';
import { GlassScreen, GradientHeader, GlassCard } from '@/components/glass';
import {
  FormModal,
  Textarea,
  SwitchRow,
  ConfirmModal,
  ActionSheet,
  Fab,
  type SheetAction,
} from '@/components/forms';
import { spacing, radius, font, useTheme } from '@/theme';
import type { PaginatedWebsiteProducts, WebsiteProduct } from '@/types';

/**
 * Website Content → Products (mirrors the ERP `/erp/website/products` page).
 *
 * Marketing products/solutions advertised on the PUBLIC website. ADMIN-only
 * CRUD. Everyone can read, but the create/edit/delete affordances are gated to
 * admins (matching the backend RolesGuard).
 */

interface PForm {
  name: string;
  tagline: string;
  description: string;
  category: string;
  price: string;
  imageUrl: string;
  productUrl: string;
  featuresCsv: string;
  featured: boolean;
  sortOrder: string;
}

const EMPTY: PForm = {
  name: '',
  tagline: '',
  description: '',
  category: '',
  price: '',
  imageUrl: '',
  productUrl: '',
  featuresCsv: '',
  featured: false,
  sortOrder: '0',
};

const URL_RE = /^https?:\/\/.+/i;

export default function WebsiteProductsScreen() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.isAdmin());

  const products = useQuery({
    queryKey: ['website-products-mobile'],
    queryFn: (): Promise<PaginatedWebsiteProducts> =>
      websiteProductsApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const rows = products.data?.products ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WebsiteProduct | null>(null);
  const [form, setForm] = useState<PForm>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<WebsiteProduct | null>(null);
  const [deleteFor, setDeleteFor] = useState<WebsiteProduct | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setErr(null);
    setFormOpen(true);
  };
  const openEdit = (p: WebsiteProduct) => {
    setEditing(p);
    setForm({
      name: p.name,
      tagline: p.tagline ?? '',
      description: p.description,
      category: p.category ?? '',
      price: p.price ?? '',
      imageUrl: p.imageUrl ?? '',
      productUrl: p.productUrl ?? '',
      featuresCsv: (p.features ?? []).join(', '),
      featured: p.featured,
      sortOrder: String(p.sortOrder ?? 0),
    });
    setErr(null);
    setFormOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const features = form.featuresCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload: WebsiteProductInput = {
        name: form.name.trim(),
        tagline: form.tagline.trim() || null,
        description: form.description.trim(),
        category: form.category.trim() || null,
        price: form.price.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        productUrl: form.productUrl.trim() || null,
        features: features.length ? features : null,
        featured: form.featured,
        sortOrder: Number.isFinite(parseInt(form.sortOrder, 10)) ? parseInt(form.sortOrder, 10) : 0,
      };
      return editing
        ? websiteProductsApi.update(editing.id, payload)
        : websiteProductsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['website-products-mobile'] });
      setFormOpen(false);
    },
    onError: (e) => setErr(apiError(e, 'Failed to save product')),
  });

  const del = useMutation({
    mutationFn: (id: string) => websiteProductsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['website-products-mobile'] });
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, 'Failed to delete product')),
  });

  const submit = () => {
    if (form.name.trim().length < 2) return setErr('Name must be at least 2 characters.');
    if (form.description.trim().length < 10)
      return setErr('Description must be at least 10 characters.');
    if (form.imageUrl.trim() && !URL_RE.test(form.imageUrl.trim()))
      return setErr('Image URL must start with http:// or https://');
    if (form.productUrl.trim() && !URL_RE.test(form.productUrl.trim()))
      return setErr('Product URL must start with http:// or https://');
    setErr(null);
    save.mutate();
  };

  const renderItem = ({ item }: { item: WebsiteProduct }) => (
    <GlassCard
      onPress={() => (isAdmin ? setSheetFor(item) : undefined)}
      padded={false}
      style={{ marginBottom: spacing.sm }}
    >
      {item.imageUrl ? (
        <View style={{ position: 'relative' }}>
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: '100%', height: 150, backgroundColor: colors.cardAlt }}
            resizeMode="cover"
          />
          {item.featured ? <FeaturedBadge /> : null}
        </View>
      ) : null}
      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {!item.imageUrl ? (
            <Ionicons name="cube-outline" size={18} color={colors.accent} />
          ) : null}
          <Text
            style={{ color: colors.text, fontSize: font.md, fontWeight: '700', flex: 1 }}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {item.category ? <Chip label={item.category} /> : null}
          {!item.imageUrl && item.featured ? (
            <Ionicons name="star" size={14} color={colors.accent} />
          ) : null}
        </View>
        {item.price ? (
          <Text style={{ color: colors.accent, fontSize: font.xs, fontWeight: '700' }}>
            {item.price}
          </Text>
        ) : null}
        <Text style={{ color: colors.textDim, fontSize: font.sm, lineHeight: 20 }} numberOfLines={2}>
          {item.tagline || item.description}
        </Text>
      </View>
    </GlassCard>
  );

  return (
    <GlassScreen>
      <GradientHeader
        title="Website Products"
        subtitle={`${products.data?.total ?? rows.length} total`}
        icon="pricetags-outline"
      />
      {products.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={products.isFetching}
              onRefresh={() => products.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="pricetags-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>No website products yet.</Text>
            </View>
          }
        />
      )}

      {isAdmin ? <Fab onPress={openCreate} /> : null}

      <FormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Product' : 'New Product'}
        subtitle="Shown on the public website"
        onSubmit={submit}
        submitting={save.isPending}
        error={err ?? undefined}
      >
        <Input
          label="Name"
          value={form.name}
          onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
          placeholder="School ERP"
        />
        <Input
          label="Price (display)"
          value={form.price}
          onChangeText={(t) => setForm((f) => ({ ...f, price: t }))}
          placeholder="From $499 / Contact us"
        />
        <Input
          label="Tagline"
          value={form.tagline}
          onChangeText={(t) => setForm((f) => ({ ...f, tagline: t }))}
          placeholder="Short one-line tagline (optional)"
        />
        <Textarea
          label="Description"
          value={form.description}
          onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
          placeholder="Full product description (min 10 characters)"
        />
        <Input
          label="Category"
          value={form.category}
          onChangeText={(t) => setForm((f) => ({ ...f, category: t }))}
          placeholder="ERP, Mobile App… (optional)"
        />
        <Input
          label="Features (comma-separated)"
          value={form.featuresCsv}
          onChangeText={(t) => setForm((f) => ({ ...f, featuresCsv: t }))}
          placeholder="Attendance, Grading, Billing"
        />
        <Input
          label="Product / Demo URL"
          value={form.productUrl}
          onChangeText={(t) => setForm((f) => ({ ...f, productUrl: t }))}
          placeholder="https://… (optional)"
          autoCapitalize="none"
          keyboardType="url"
        />
        <Input
          label="Cover / Logo image URL"
          value={form.imageUrl}
          onChangeText={(t) => setForm((f) => ({ ...f, imageUrl: t }))}
          placeholder="https://… (optional)"
          autoCapitalize="none"
          keyboardType="url"
        />
        <Input
          label="Sort order"
          value={form.sortOrder}
          onChangeText={(t) => setForm((f) => ({ ...f, sortOrder: t.replace(/[^0-9]/g, '') }))}
          placeholder="0"
          keyboardType="number-pad"
        />
        <SwitchRow
          label="Featured on landing page"
          value={form.featured}
          onValueChange={(v) => setForm((f) => ({ ...f, featured: v }))}
        />
      </FormModal>

      <ActionSheet
        visible={!!sheetFor}
        onClose={() => setSheetFor(null)}
        title={sheetFor?.name}
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
        ] as SheetAction[]}
      />

      <ConfirmModal
        visible={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        onConfirm={() => deleteFor && del.mutate(deleteFor.id)}
        title="Delete Product"
        message={`Permanently remove "${deleteFor?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        submitting={del.isPending}
        error={deleteErr ?? undefined}
      />
    </GlassScreen>
  );
}

function Chip({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.cardAlt,
        borderRadius: radius.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 9,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function FeaturedBadge() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top: spacing.sm,
        left: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Ionicons name="star" size={11} color={colors.accent} />
      <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '800' }}>Featured</Text>
    </View>
  );
}
