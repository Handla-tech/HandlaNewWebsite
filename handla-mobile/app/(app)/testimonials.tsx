import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { testimonialsApi, type TestimonialInput } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Loading, Input, Label } from '@/components/ui';
import { GlassScreen, GradientHeader, GlassCard, Avatar } from '@/components/glass';
import {
  FormModal,
  Textarea,
  ConfirmModal,
  ActionSheet,
  Fab,
  type SheetAction,
} from '@/components/forms';
import { spacing, radius, font, useTheme } from '@/theme';
import type { PaginatedTestimonials, Testimonial } from '@/types';
import { useT } from '@/i18n';

function Stars({ rating, color }: { rating: number; color: string }) {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < r ? 'star' : 'star-outline'}
          size={14}
          color={i < r ? color : '#6b7280'}
        />
      ))}
    </View>
  );
}

function RatingPicker({
  value,
  onChange,
  color,
}: {
  value: number;
  onChange: (n: number) => void;
  color: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Pressable key={i} onPress={() => onChange(i + 1)} hitSlop={6}>
          <Ionicons
            name={i < value ? 'star' : 'star-outline'}
            size={30}
            color={i < value ? color : '#6b7280'}
          />
        </Pressable>
      ))}
    </View>
  );
}

interface TForm {
  clientName: string;
  clientCompany: string;
  content: string;
  imageUrl: string;
  rating: number;
}
const EMPTY: TForm = { clientName: '', clientCompany: '', content: '', imageUrl: '', rating: 5 };

export default function TestimonialsScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.isAdmin());

  const testimonials = useQuery({
    queryKey: ['testimonials-mobile'],
    queryFn: (): Promise<PaginatedTestimonials> =>
      testimonialsApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const rows = testimonials.data?.testimonials ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState<TForm>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<Testimonial | null>(null);
  const [deleteFor, setDeleteFor] = useState<Testimonial | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setErr(null);
    setFormOpen(true);
  };
  const openEdit = (row: Testimonial) => {
    setEditing(row);
    setForm({
      clientName: row.clientName,
      clientCompany: row.clientCompany ?? '',
      content: row.content,
      imageUrl: row.imageUrl ?? '',
      rating: row.rating,
    });
    setErr(null);
    setFormOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload: TestimonialInput = {
        clientName: form.clientName.trim(),
        clientCompany: form.clientCompany.trim() || null,
        content: form.content.trim(),
        imageUrl: form.imageUrl.trim() || null,
        rating: form.rating,
      };
      return editing
        ? testimonialsApi.update(editing.id, payload)
        : testimonialsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['testimonials-mobile'] });
      setFormOpen(false);
    },
    onError: (e) => setErr(apiError(e, t('testimonials.saveError'))),
  });
  const del = useMutation({
    mutationFn: (id: string) => testimonialsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['testimonials-mobile'] });
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, t('testimonials.deleteError'))),
  });
  const submit = () => {
    if (form.clientName.trim().length < 2) return setErr(t('testimonials.nameError'));
    if (form.content.trim().length < 10) return setErr(t('testimonials.contentError'));
    if (form.imageUrl.trim() && !/^https?:\/\/.+/i.test(form.imageUrl.trim()))
      return setErr(t('testimonials.urlError'));
    if (form.rating < 1 || form.rating > 5) return setErr(t('testimonials.ratingError'));
    setErr(null);
    save.mutate();
  };

  const renderItem = ({ item }: { item: Testimonial }) => (
    <GlassCard
      onPress={() => (isAdmin ? setSheetFor(item) : undefined)}
      padded={false}
      style={{ marginBottom: spacing.sm }}
    >
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={item.clientName} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }} numberOfLines={1}>
              {item.clientName}
            </Text>
            {item.clientCompany ? (
              <Text style={{ color: colors.textFaint, fontSize: font.xs }} numberOfLines={1}>
                {item.clientCompany}
              </Text>
            ) : null}
          </View>
          <Stars rating={item.rating} color={colors.accent} />
        </View>
        <Text style={{ color: colors.textDim, fontSize: font.sm, lineHeight: 20 }} numberOfLines={4}>
          “{item.content}”
        </Text>
      </View>
    </GlassCard>
  );

  return (
    <GlassScreen>
      <GradientHeader title={t('testimonials.title')} icon="chatbox-ellipses-outline" />
      {testimonials.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={testimonials.isFetching}
              onRefresh={() => testimonials.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="chatbox-ellipses-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>{t('testimonials.empty')}</Text>
            </View>
          }
        />
      )}

      {isAdmin ? <Fab onPress={openCreate} /> : null}

      <FormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('testimonials.editTitle') : t('testimonials.newTitle')}
        onSubmit={submit}
        submitting={save.isPending}
        error={err ?? undefined}
      >
        <Input
          label={t('testimonials.clientName')}
          value={form.clientName}
          onChangeText={(v) => setForm((f) => ({ ...f, clientName: v }))}
          placeholder={t('testimonials.clientNamePlaceholder')}
          autoCapitalize="words"
        />
        <Input
          label={t('testimonials.company')}
          value={form.clientCompany}
          onChangeText={(v) => setForm((f) => ({ ...f, clientCompany: v }))}
          placeholder={t('common.optional')}
        />
        <Textarea
          label={t('testimonials.content')}
          value={form.content}
          onChangeText={(v) => setForm((f) => ({ ...f, content: v }))}
          placeholder={t('testimonials.contentPlaceholder')}
        />
        <Input
          label={t('testimonials.avatarUrl')}
          value={form.imageUrl}
          onChangeText={(v) => setForm((f) => ({ ...f, imageUrl: v }))}
          placeholder={t('testimonials.urlPlaceholder')}
          autoCapitalize="none"
          keyboardType="url"
        />
        <View style={{ gap: spacing.sm }}>
          <Label>{t('testimonials.rating')}</Label>
          <RatingPicker
            value={form.rating}
            onChange={(n) => setForm((f) => ({ ...f, rating: n }))}
            color={colors.accent}
          />
        </View>
      </FormModal>

      <ActionSheet
        visible={!!sheetFor}
        onClose={() => setSheetFor(null)}
        title={sheetFor?.clientName}
        actions={[
          {
            label: t('common.edit'),
            icon: 'create-outline',
            onPress: () => {
              const row = sheetFor;
              setSheetFor(null);
              if (row) openEdit(row);
            },
          },
          {
            label: t('common.delete'),
            icon: 'trash-outline',
            destructive: true,
            onPress: () => {
              const row = sheetFor;
              setSheetFor(null);
              setDeleteErr(null);
              if (row) setDeleteFor(row);
            },
          },
        ] as SheetAction[]}
      />

      <ConfirmModal
        visible={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        onConfirm={() => deleteFor && del.mutate(deleteFor.id)}
        title={t('testimonials.deleteTitle')}
        message={t('testimonials.deleteMsg', { name: deleteFor?.clientName ?? '' })}
        confirmLabel={t('common.delete')}
        destructive
        submitting={del.isPending}
        error={deleteErr ?? undefined}
      />
    </GlassScreen>
  );
}
