import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { testimonialsApi, type TestimonialInput } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Title, Loading, Input, Label } from '@/components/ui';
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
  const openEdit = (t: Testimonial) => {
    setEditing(t);
    setForm({
      clientName: t.clientName,
      clientCompany: t.clientCompany ?? '',
      content: t.content,
      imageUrl: t.imageUrl ?? '',
      rating: t.rating,
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
    onError: (e) => setErr(apiError(e, 'Failed to save testimonial')),
  });
  const del = useMutation({
    mutationFn: (id: string) => testimonialsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['testimonials-mobile'] });
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, 'Failed to delete testimonial')),
  });
  const submit = () => {
    if (form.clientName.trim().length < 2) return setErr('Client name must be at least 2 characters.');
    if (form.content.trim().length < 10) return setErr('Testimonial must be at least 10 characters.');
    if (form.imageUrl.trim() && !/^https?:\/\/.+/i.test(form.imageUrl.trim()))
      return setErr('Image URL must start with http:// or https://');
    if (form.rating < 1 || form.rating > 5) return setErr('Pick a rating from 1 to 5.');
    setErr(null);
    save.mutate();
  };

  const renderItem = ({ item }: { item: Testimonial }) => (
    <Pressable
      onPress={() => isAdmin && setSheetFor(item)}
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.accent, fontWeight: '800' }}>
            {(item.clientName ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
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
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Testimonials</Title>
      </View>
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
              <Text style={{ color: colors.textFaint }}>No testimonials yet.</Text>
            </View>
          }
        />
      )}

      {isAdmin ? <Fab onPress={openCreate} /> : null}

      <FormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Testimonial' : 'New Testimonial'}
        onSubmit={submit}
        submitting={save.isPending}
        error={err ?? undefined}
      >
        <Input
          label="Client name"
          value={form.clientName}
          onChangeText={(t) => setForm((f) => ({ ...f, clientName: t }))}
          placeholder="Jane Smith"
          autoCapitalize="words"
        />
        <Input
          label="Company"
          value={form.clientCompany}
          onChangeText={(t) => setForm((f) => ({ ...f, clientCompany: t }))}
          placeholder="Optional"
        />
        <Textarea
          label="Testimonial"
          value={form.content}
          onChangeText={(t) => setForm((f) => ({ ...f, content: t }))}
          placeholder="What did the client say? (min 10 characters)"
        />
        <Input
          label="Avatar image URL"
          value={form.imageUrl}
          onChangeText={(t) => setForm((f) => ({ ...f, imageUrl: t }))}
          placeholder="https://… (optional)"
          autoCapitalize="none"
          keyboardType="url"
        />
        <View style={{ gap: spacing.sm }}>
          <Label>Rating</Label>
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
            label: 'Edit',
            icon: 'create-outline',
            onPress: () => {
              const t = sheetFor;
              setSheetFor(null);
              if (t) openEdit(t);
            },
          },
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
        ] as SheetAction[]}
      />

      <ConfirmModal
        visible={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        onConfirm={() => deleteFor && del.mutate(deleteFor.id)}
        title="Delete Testimonial"
        message={`Delete the testimonial from "${deleteFor?.clientName}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        submitting={del.isPending}
        error={deleteErr ?? undefined}
      />
    </SafeAreaView>
  );
}
