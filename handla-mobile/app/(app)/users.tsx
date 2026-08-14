import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView, Pressable } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usersApi } from '@/lib/endpoints';
import type { UsersQuery } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Title, Loading, Badge, Chip, Input } from '@/components/ui';
import {
  FormModal,
  Select,
  ConfirmModal,
  ActionSheet,
  Fab,
  type SelectOption,
  type SheetAction,
} from '@/components/forms';
import { spacing, radius, font, useTheme, colors as staticColors } from '@/theme';
import type { PaginatedUsers, TeamMember, UserRole } from '@/types';

const ROLE_META: Record<UserRole, { label: string; color: string; soft: string }> = {
  ADMIN: { label: 'Admin', color: staticColors.accent, soft: staticColors.accentSoft },
  EMPLOYEE: { label: 'Employee', color: staticColors.info, soft: 'rgba(96,165,250,0.15)' },
  CLIENT: { label: 'Client', color: staticColors.success, soft: staticColors.successSoft },
  LEAD: { label: 'Lead', color: '#c084fc', soft: 'rgba(192,132,252,0.15)' },
};

const ROLE_FILTERS: (UserRole | null)[] = [null, 'ADMIN', 'EMPLOYEE', 'CLIENT', 'LEAD'];
const ROLE_OPTIONS: SelectOption[] = [
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Employee', value: 'EMPLOYEE' },
  { label: 'Client', value: 'CLIENT' },
  { label: 'Lead', value: 'LEAD' },
];

function initials(name: string) {
  return (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

type Mode = 'create' | 'edit' | 'role' | 'password';

export default function UsersScreen() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [role, setRole] = useState<UserRole | null>(null);

  const params: UsersQuery = useMemo(
    () => ({ limit: 100, ...(role ? { role } : {}) }),
    [role],
  );

  const users = useQuery({
    queryKey: ['users-mobile', role],
    queryFn: (): Promise<PaginatedUsers> => usersApi.list(params).then((r) => r.data.data),
  });

  const rows = users.data?.users ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users-mobile'] });

  // ─── form state ─────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('create');
  const [target, setTarget] = useState<TeamMember | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleField, setRoleField] = useState<UserRole>('EMPLOYEE');

  const [sheetFor, setSheetFor] = useState<TeamMember | null>(null);
  const [deleteFor, setDeleteFor] = useState<TeamMember | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const openCreate = () => {
    setMode('create');
    setTarget(null);
    setName('');
    setEmail('');
    setPassword('');
    setRoleField('EMPLOYEE');
    setErr(null);
    setFormOpen(true);
  };
  const openEdit = (u: TeamMember) => {
    setMode('edit');
    setTarget(u);
    setName(u.name);
    setEmail(u.email);
    setErr(null);
    setFormOpen(true);
  };
  const openRole = (u: TeamMember) => {
    setMode('role');
    setTarget(u);
    setRoleField(u.role);
    setErr(null);
    setFormOpen(true);
  };
  const openPassword = (u: TeamMember) => {
    setMode('password');
    setTarget(u);
    setPassword('');
    setErr(null);
    setFormOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (mode === 'create') {
        await usersApi.create({
          name: name.trim(),
          email: email.trim(),
          password,
          role: roleField,
        });
      } else if (mode === 'edit' && target) {
        await usersApi.update(target.id, {
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
        });
      } else if (mode === 'role' && target) {
        await usersApi.setRole(target.id, roleField);
      } else if (mode === 'password' && target) {
        await usersApi.resetPassword(target.id, password);
      }
    },
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
    },
    onError: (e) => setErr(apiError(e, 'Failed to save')),
  });

  const simpleAction = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: invalidate,
    onError: (e) => setErr(apiError(e, 'Action failed')),
  });

  const del = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, 'Failed to delete user')),
  });

  const submit = () => {
    if (mode === 'create') {
      if (name.trim().length < 2) return setErr('Name must be at least 2 characters.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        return setErr('A valid email is required.');
      if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password))
        return setErr('Password: min 8 chars with uppercase, lowercase and a number.');
    } else if (mode === 'edit') {
      if (name.trim().length < 2) return setErr('Name must be at least 2 characters.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        return setErr('A valid email is required.');
    } else if (mode === 'password') {
      if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password))
        return setErr('Password: min 8 chars with uppercase, lowercase and a number.');
    }
    setErr(null);
    save.mutate();
  };

  const formTitle =
    mode === 'create'
      ? 'New User'
      : mode === 'edit'
        ? 'Edit User'
        : mode === 'role'
          ? 'Change Role'
          : 'Reset Password';

  const buildActions = (u: TeamMember): SheetAction[] => {
    const actions: SheetAction[] = [
      {
        label: 'Edit name / email',
        icon: 'create-outline',
        onPress: () => {
          setSheetFor(null);
          openEdit(u);
        },
      },
      {
        label: 'Change role',
        icon: 'swap-horizontal-outline',
        onPress: () => {
          setSheetFor(null);
          openRole(u);
        },
      },
      {
        label: 'Reset password',
        icon: 'key-outline',
        onPress: () => {
          setSheetFor(null);
          openPassword(u);
        },
      },
    ];
    if (u.role === 'LEAD') {
      actions.push({
        label: 'Promote to client',
        icon: 'trending-up-outline',
        onPress: () => {
          setSheetFor(null);
          simpleAction.mutate(() => usersApi.promote(u.id));
        },
      });
    }
    actions.push({
      label: u.isDisabled ? 'Enable' : 'Disable',
      icon: u.isDisabled ? 'lock-open-outline' : 'lock-closed-outline',
      onPress: () => {
        setSheetFor(null);
        simpleAction.mutate(() => (u.isDisabled ? usersApi.enable(u.id) : usersApi.disable(u.id)));
      },
    });
    actions.push({
      label: u.isArchived ? 'Unarchive' : 'Archive',
      icon: u.isArchived ? 'arrow-undo-outline' : 'archive-outline',
      onPress: () => {
        setSheetFor(null);
        simpleAction.mutate(() =>
          u.isArchived ? usersApi.unarchive(u.id) : usersApi.archive(u.id),
        );
      },
    });
    actions.push({
      label: 'Delete',
      icon: 'trash-outline',
      destructive: true,
      onPress: () => {
        setSheetFor(null);
        setDeleteErr(null);
        setDeleteFor(u);
      },
    });
    return actions;
  };

  const renderItem = ({ item }: { item: TeamMember }) => {
    const m = ROLE_META[item.role];
    const inactive = item.isArchived || item.isDisabled;
    return (
      <Pressable
        onPress={() => isAdmin && setSheetFor(item)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
          opacity: inactive ? 0.5 : 1,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: m.soft,
            borderWidth: 1,
            borderColor: m.color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: m.color, fontWeight: '800', fontSize: font.sm }}>
            {initials(item.name)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: font.sm }} numberOfLines={1}>
            {item.email}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Badge label={m.label} color={m.color} soft={m.soft} />
          {item.isDisabled ? (
            <Text style={{ color: colors.danger, fontSize: 10, fontWeight: '700' }}>DISABLED</Text>
          ) : item.isArchived ? (
            <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: '700' }}>ARCHIVED</Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Users</Title>
        <Text style={{ color: colors.textDim, fontSize: font.xs, marginTop: 2 }}>
          {users.data ? `${users.data.total} members` : 'Loading…'}
        </Text>
      </View>
      {users.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={users.isFetching}
              onRefresh={() => users.refetch()}
              tintColor={colors.accent}
            />
          }
          ListHeaderComponent={
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
            >
              {ROLE_FILTERS.map((r) => (
                <Chip
                  key={r ?? 'all'}
                  label={r ? ROLE_META[r].label : 'All'}
                  active={role === r}
                  onPress={() => setRole(r)}
                />
              ))}
            </ScrollView>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="people-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>No users found.</Text>
            </View>
          }
        />
      )}

      {isAdmin ? <Fab onPress={openCreate} /> : null}

      <FormModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={formTitle}
        subtitle={target ? target.name : undefined}
        onSubmit={submit}
        submitting={save.isPending}
        error={err ?? undefined}
      >
        {(mode === 'create' || mode === 'edit') && (
          <>
            <Input
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Jane Smith"
              autoCapitalize="words"
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="jane@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </>
        )}
        {(mode === 'create' || mode === 'password') && (
          <Input
            label={mode === 'create' ? 'Temporary password' : 'New password'}
            value={password}
            onChangeText={setPassword}
            placeholder="Min 8 chars, mixed case + number"
            autoCapitalize="none"
            secureTextEntry
          />
        )}
        {(mode === 'create' || mode === 'role') && (
          <Select
            label="Role"
            value={roleField}
            options={ROLE_OPTIONS}
            onChange={(v) => setRoleField(v as UserRole)}
          />
        )}
      </FormModal>

      <ActionSheet
        visible={!!sheetFor}
        onClose={() => setSheetFor(null)}
        title={sheetFor?.name}
        actions={sheetFor ? buildActions(sheetFor) : []}
      />

      <ConfirmModal
        visible={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        onConfirm={() => deleteFor && del.mutate(deleteFor.id)}
        title="Delete User"
        message={`Delete "${deleteFor?.name}"? This permanently removes the account and cannot be undone.`}
        confirmLabel="Delete"
        destructive
        submitting={del.isPending}
        error={deleteErr ?? undefined}
      />
    </SafeAreaView>
  );
}
