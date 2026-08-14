import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { projectsApi } from '@/lib/endpoints';
import { useAuthStore } from '@/store/authStore';
import { Title, Loading, Badge, Chip } from '@/components/ui';
import { statusColor, prettyStatus } from '@/lib/statusMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import type { PaginatedProjects, Project, ProjectStatus } from '@/types';

const STATUSES: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProjectsScreen() {
  const { colors } = useTheme();
  const isClient = useAuthStore((s) => s.isClient());
  const [status, setStatus] = useState<ProjectStatus | null>(null);

  const query = useMemo(() => ({ limit: 50, ...(status ? { status } : {}) }), [status]);

  const projects = useQuery({
    queryKey: ['projects-mobile', status],
    queryFn: (): Promise<PaginatedProjects> => {
      const req = isClient ? projectsApi.mine(query) : projectsApi.list(query);
      return req.then((r) => r.data.data);
    },
  });

  const rows = projects.data?.projects ?? [];

  const renderItem = ({ item }: { item: Project }) => {
    const sc = statusColor(item.status);
    const clientName = item.client?.user?.name ?? item.client?.company ?? '';
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        }}
      >
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
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Projects</Title>
      </View>

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
    </SafeAreaView>
  );
}
