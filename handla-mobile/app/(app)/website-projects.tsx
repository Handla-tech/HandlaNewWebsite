import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Image } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { websiteProjectsApi, type WebsiteProjectInput } from '@/lib/endpoints';
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
import type { PaginatedWebsiteProjects, WebsiteProject } from '@/types';
import { useT } from '@/i18n';

/**
 * Website Content → Projects (mirrors the ERP `/erp/website/projects` page).
 *
 * Showcase/portfolio projects on the PUBLIC website — completely separate from
 * the internal ERP `Project` module. ADMIN-only CRUD.
 */

interface JForm {
  title: string;
  clientName: string;
  summary: string;
  description: string;
  category: string;
  imageUrl: string;
  projectUrl: string;
  tagsCsv: string;
  featured: boolean;
  sortOrder: string;
}

const EMPTY: JForm = {
  title: '',
  clientName: '',
  summary: '',
  description: '',
  category: '',
  imageUrl: '',
  projectUrl: '',
  tagsCsv: '',
  featured: false,
  sortOrder: '0',
};

const URL_RE = /^https?:\/\/.+/i;

export default function WebsiteProjectsScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.isAdmin());

  const projects = useQuery({
    queryKey: ['website-projects-mobile'],
    queryFn: (): Promise<PaginatedWebsiteProjects> =>
      websiteProjectsApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const rows = projects.data?.projects ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WebsiteProject | null>(null);
  const [form, setForm] = useState<JForm>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<WebsiteProject | null>(null);
  const [deleteFor, setDeleteFor] = useState<WebsiteProject | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setErr(null);
    setFormOpen(true);
  };
  const openEdit = (p: WebsiteProject) => {
    setEditing(p);
    setForm({
      title: p.title,
      clientName: p.clientName ?? '',
      summary: p.summary ?? '',
      description: p.description,
      category: p.category ?? '',
      imageUrl: p.imageUrl ?? '',
      projectUrl: p.projectUrl ?? '',
      tagsCsv: (p.tags ?? []).join(', '),
      featured: p.featured,
      sortOrder: String(p.sortOrder ?? 0),
    });
    setErr(null);
    setFormOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const tags = form.tagsCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload: WebsiteProjectInput = {
        title: form.title.trim(),
        clientName: form.clientName.trim() || null,
        summary: form.summary.trim() || null,
        description: form.description.trim(),
        category: form.category.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        projectUrl: form.projectUrl.trim() || null,
        tags: tags.length ? tags : null,
        featured: form.featured,
        sortOrder: Number.isFinite(parseInt(form.sortOrder, 10)) ? parseInt(form.sortOrder, 10) : 0,
      };
      return editing
        ? websiteProjectsApi.update(editing.id, payload)
        : websiteProjectsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['website-projects-mobile'] });
      setFormOpen(false);
    },
    onError: (e) => setErr(apiError(e, t('websiteProjects.saveError'))),
  });

  const del = useMutation({
    mutationFn: (id: string) => websiteProjectsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['website-projects-mobile'] });
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, t('websiteProjects.deleteError'))),
  });

  const submit = () => {
    if (form.title.trim().length < 2) return setErr(t('websiteProjects.titleError'));
    if (form.description.trim().length < 10)
      return setErr(t('websiteProjects.descriptionError'));
    if (form.imageUrl.trim() && !URL_RE.test(form.imageUrl.trim()))
      return setErr(t('websiteProjects.imageUrlError'));
    if (form.projectUrl.trim() && !URL_RE.test(form.projectUrl.trim()))
      return setErr(t('websiteProjects.projectUrlError'));
    setErr(null);
    save.mutate();
  };

  const renderItem = ({ item }: { item: WebsiteProject }) => (
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
            <Ionicons name="briefcase-outline" size={18} color={colors.accent} />
          ) : null}
          <Text
            style={{ color: colors.text, fontSize: font.md, fontWeight: '700', flex: 1 }}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {item.category ? <Chip label={item.category} /> : null}
          {!item.imageUrl && item.featured ? (
            <Ionicons name="star" size={14} color={colors.accent} />
          ) : null}
        </View>
        {item.clientName ? (
          <Text style={{ color: colors.accent, fontSize: font.xs, fontWeight: '700' }}>
            {item.clientName}
          </Text>
        ) : null}
        <Text style={{ color: colors.textDim, fontSize: font.sm, lineHeight: 20 }} numberOfLines={2}>
          {item.summary || item.description}
        </Text>
        {item.tags && item.tags.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
            {item.tags.slice(0, 4).map((tag) => (
              <Chip key={tag} label={tag} />
            ))}
          </View>
        ) : null}
      </View>
    </GlassCard>
  );

  return (
    <GlassScreen>
      <GradientHeader
        title={t('websiteProjects.title')}
        subtitle={t('websiteProjects.totalCount', { count: projects.data?.total ?? rows.length })}
        icon="albums-outline"
      />
      {projects.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={projects.isFetching}
              onRefresh={() => projects.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="albums-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>{t('websiteProjects.empty')}</Text>
            </View>
          }
        />
      )}

      {isAdmin ? <Fab onPress={openCreate} /> : null}

      <FormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('websiteProjects.editTitle') : t('websiteProjects.newTitle')}
        subtitle={t('websiteProjects.modalSubtitle')}
        onSubmit={submit}
        submitting={save.isPending}
        error={err ?? undefined}
      >
        <Input
          label={t('websiteProjects.titleField')}
          value={form.title}
          onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
          placeholder={t('websiteProjects.titlePlaceholder')}
        />
        <Input
          label={t('websiteProjects.clientName')}
          value={form.clientName}
          onChangeText={(v) => setForm((f) => ({ ...f, clientName: v }))}
          placeholder={t('common.optional')}
        />
        <Input
          label={t('websiteProjects.summary')}
          value={form.summary}
          onChangeText={(v) => setForm((f) => ({ ...f, summary: v }))}
          placeholder={t('websiteProjects.summaryPlaceholder')}
        />
        <Textarea
          label={t('websiteProjects.description')}
          value={form.description}
          onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
          placeholder={t('websiteProjects.descriptionPlaceholder')}
        />
        <Input
          label={t('websiteProjects.category')}
          value={form.category}
          onChangeText={(v) => setForm((f) => ({ ...f, category: v }))}
          placeholder={t('websiteProjects.categoryPlaceholder')}
        />
        <Input
          label={t('websiteProjects.tags')}
          value={form.tagsCsv}
          onChangeText={(v) => setForm((f) => ({ ...f, tagsCsv: v }))}
          placeholder={t('websiteProjects.tagsPlaceholder')}
        />
        <Input
          label={t('websiteProjects.projectUrl')}
          value={form.projectUrl}
          onChangeText={(v) => setForm((f) => ({ ...f, projectUrl: v }))}
          placeholder={t('websiteProjects.urlPlaceholder')}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Input
          label={t('websiteProjects.coverUrl')}
          value={form.imageUrl}
          onChangeText={(v) => setForm((f) => ({ ...f, imageUrl: v }))}
          placeholder={t('websiteProjects.urlPlaceholder')}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Input
          label={t('websiteProjects.sortOrder')}
          value={form.sortOrder}
          onChangeText={(v) => setForm((f) => ({ ...f, sortOrder: v.replace(/[^0-9]/g, '') }))}
          placeholder="0"
          keyboardType="number-pad"
        />
        <SwitchRow
          label={t('websiteProjects.featuredToggle')}
          value={form.featured}
          onValueChange={(v) => setForm((f) => ({ ...f, featured: v }))}
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
              const p = sheetFor;
              setSheetFor(null);
              if (p) openEdit(p);
            },
          },
          {
            label: t('common.delete'),
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
        title={t('websiteProjects.deleteTitle')}
        message={t('websiteProjects.deleteMsg', { name: deleteFor?.title ?? '' })}
        confirmLabel={t('common.delete')}
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
  const { t } = useT();
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
      <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '800' }}>{t('common.featured')}</Text>
    </View>
  );
}
