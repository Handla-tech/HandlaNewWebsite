import React from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { testimonialsApi } from '@/lib/endpoints';
import { Title, Loading } from '@/components/ui';
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

export default function TestimonialsScreen() {
  const { colors } = useTheme();

  const testimonials = useQuery({
    queryKey: ['testimonials-mobile'],
    queryFn: (): Promise<PaginatedTestimonials> =>
      testimonialsApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const rows = testimonials.data?.testimonials ?? [];

  const renderItem = ({ item }: { item: Testimonial }) => (
    <View
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
    </View>
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
    </SafeAreaView>
  );
}
