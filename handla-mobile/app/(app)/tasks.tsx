import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tasksApi } from '@/lib/endpoints';
import { Title, Loading, Badge, Chip } from '@/components/ui';
import { statusColor, prettyStatus } from '@/lib/statusMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import type { PaginatedTasks, Task, TaskStatus } from '@/types';

const STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED'];

function fmtDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TasksScreen() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<TaskStatus | null>(null);

  const query = useMemo(() => ({ limit: 50, ...(status ? { status } : {}) }), [status]);

  const tasks = useQuery({
    queryKey: ['tasks-mobile', status],
    queryFn: (): Promise<PaginatedTasks> => tasksApi.list(query).then((r) => r.data.data),
  });

  const rows = tasks.data?.tasks ?? [];

  const renderItem = ({ item }: { item: Task }) => {
    const sc = statusColor(item.status);
    const due = fmtDate(item.dueDate);
    const overdue =
      item.dueDate != null &&
      item.status !== 'COMPLETED' &&
      new Date(item.dueDate).getTime() < Date.now();
    const assignee = item.assignee?.name ?? null;
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
          <Ionicons
            name={item.status === 'COMPLETED' ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={sc.color}
          />
          <Text
            style={{ flex: 1, color: colors.text, fontSize: font.md, fontWeight: '700' }}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Badge label={prettyStatus(item.status)} color={sc.color} soft={sc.soft} />
        </View>
        {item.project?.title ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons name="folder-outline" size={12} color={colors.textFaint} />
            <Text style={{ color: colors.textFaint, fontSize: font.sm }} numberOfLines={1}>
              {item.project.title}
            </Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
          {assignee ? (
            <Text style={{ color: colors.textDim, fontSize: font.xs }}>👤 {assignee}</Text>
          ) : null}
          {due ? (
            <Text
              style={{
                color: overdue ? '#ef4444' : colors.textDim,
                fontSize: font.xs,
                fontWeight: overdue ? '700' : '400',
              }}
            >
              Due {due}
              {overdue ? ' • overdue' : ''}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Tasks</Title>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm }}
        style={{ maxHeight: 44, flexGrow: 0 }}
      >
        <Chip label="All" active={status === null} onPress={() => setStatus(null)} />
        {STATUSES.map((s) => (
          <Chip key={s} label={prettyStatus(s)} active={status === s} onPress={() => setStatus(s)} />
        ))}
      </ScrollView>

      {tasks.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={tasks.isFetching}
              onRefresh={() => tasks.refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="checkbox-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>No tasks found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
