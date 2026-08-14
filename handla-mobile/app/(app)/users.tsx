import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { usersApi } from '@/lib/endpoints';
import type { UsersQuery } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge, Chip, Input } from '@/components/ui';
import { GlassScreen, GradientHeader, GlassListItem } from '@/components/glass';
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
import { useT } from '@/i18n';
import type { PaginatedUsers, TeamMember, UserRole } from '@/types';

const ROLE_META: Record<UserRole, { color: string; soft: string }> = {
  ADMIN: { color: staticColors.accent, soft: staticColors.accentSoft },
  EMPLOYEE: { color: staticColors.info, soft: 'rgba(96,165,250,0.15)' },
  CLIENT: { color: staticColors.success, soft: staticColors.successSoft },
  LEAD: { color: '#c084fc', soft: 'rgba(192,132,252,0.15)' },
};

const ROLE_FILTERS: (UserRole | null)[] = [null, 'ADMIN', 'EMPLOYEE', 'CLIENT', 'LEAD'];
const ROLE_VALUES: UserRole[] = ['ADMIN', 'EMPLOYEE', 'CLIENT', 'LEAD'];

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
  const { t } = useT();
  const { colors } = useTheme();
  const ROLE_OPTIONS: SelectOption[] = ROLE_VALUES.map((r) => ({
    label: t(`role.${r}`),
    value: r,
  }));
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
    onError: (e) => setErr(apiError(e, t('users.errors.save'))),
  });

  const simpleAction = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: invalidate,
    onError: (e) => setErr(apiError(e, t('users.errors.action'))),
  });

  const del = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleteFor(null);
    },
    onError: (e) => setDeleteErr(apiError(e, t('users.errors.delete'))),
  });

  const submit = () => {
    if (mode === 'create') {
      if (name.trim().length < 2) return setErr(t('users.errors.name'));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        return setErr(t('users.errors.email'));
      if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password))
        return setErr(t('users.errors.password'));
    } else if (mode === 'edit') {
      if (name.trim().length < 2) return setErr(t('users.errors.name'));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        return setErr(t('users.errors.email'));
    } else if (mode === 'password') {
      if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password))
        return setErr(t('users.errors.password'));
    }
    setErr(null);
    save.mutate();
  };

  const formTitle =
    mode === 'create'
      ? t('users.newUser')
      : mode === 'edit'
        ? t('users.editUser')
        : mode === 'role'
          ? t('users.changeRole')
          : t('users.resetPassword');

  const buildActions = (u: TeamMember): SheetAction[] => {
    const actions: SheetAction[] = [
      {
        label: t('users.actions.editNameEmail'),
        icon: 'create-outline',
        onPress: () => {
          setSheetFor(null);
          openEdit(u);
        },
      },
      {
        label: t('users.actions.changeRole'),
        icon: 'swap-horizontal-outline',
        onPress: () => {
          setSheetFor(null);
          openRole(u);
        },
      },
      {
        label: t('users.actions.resetPassword'),
        icon: 'key-outline',
        onPress: () => {
          setSheetFor(null);
          openPassword(u);
        },
      },
    ];
    if (u.role === 'LEAD') {
      actions.push({
        label: t('users.actions.promote'),
        icon: 'trending-up-outline',
        onPress: () => {
          setSheetFor(null);
          simpleAction.mutate(() => usersApi.promote(u.id));
        },
      });
    }
    actions.push({
      label: u.isDisabled ? t('users.actions.enable') : t('users.actions.disable'),
      icon: u.isDisabled ? 'lock-open-outline' : 'lock-closed-outline',
      onPress: () => {
        setSheetFor(null);
        simpleAction.mutate(() => (u.isDisabled ? usersApi.enable(u.id) : usersApi.disable(u.id)));
      },
    });
    actions.push({
      label: u.isArchived ? t('users.actions.unarchive') : t('users.actions.archive'),
      icon: u.isArchived ? 'arrow-undo-outline' : 'archive-outline',
      onPress: () => {
        setSheetFor(null);
        simpleAction.mutate(() =>
          u.isArchived ? usersApi.unarchive(u.id) : usersApi.archive(u.id),
        );
      },
    });
    actions.push({
      label: t('common.delete'),
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
      <GlassListItem
        onPress={() => (isAdmin ? setSheetFor(item) : undefined)}
        style={{ opacity: inactive ? 0.55 : 1 }}
        leading={
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
        }
        title={item.name}
        subtitle={item.email}
        right={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Badge label={t(`role.${item.role}`)} color={m.color} soft={m.soft} />
            {item.isDisabled ? (
              <Text style={{ color: colors.danger, fontSize: 10, fontWeight: '700' }}>{t('users.disabled')}</Text>
            ) : item.isArchived ? (
              <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: '700' }}>{t('users.archived')}</Text>
            ) : null}
          </View>
        }
      />
    );
  };

  return (
    <GlassScreen>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <GradientHeader title={t('users.title')} icon="people-outline" style={{ paddingHorizontal: 0, paddingTop: 0 }} />
        <Text style={{ color: colors.textDim, fontSize: font.xs, marginTop: 2 }}>
          {users.data ? t('users.membersCount', { count: users.data.total }) : t('users.loading')}
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
                  label={r ? t(`role.${r}`) : t('users.all')}
                  active={role === r}
                  onPress={() => setRole(r)}
                />
              ))}
            </ScrollView>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm }}>
              <Ionicons name="people-outline" size={40} color={colors.textDim} />
              <Text style={{ color: colors.textFaint }}>{t('users.empty')}</Text>
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
              label={t('users.fullName')}
              value={name}
              onChangeText={setName}
              placeholder={t('users.fullNamePlaceholder')}
              autoCapitalize="words"
            />
            <Input
              label={t('common.email')}
              value={email}
              onChangeText={setEmail}
              placeholder={t('users.emailPlaceholder')}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </>
        )}
        {(mode === 'create' || mode === 'password') && (
          <Input
            label={mode === 'create' ? t('users.tempPassword') : t('users.newPassword')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('users.passwordPlaceholder')}
            autoCapitalize="none"
            secureTextEntry
          />
        )}
        {(mode === 'create' || mode === 'role') && (
          <Select
            label={t('users.roleLabel')}
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
        title={t('users.deleteTitle')}
        message={t('users.deleteMessage', { name: deleteFor?.name ?? '' })}
        confirmLabel={t('common.delete')}
        destructive
        submitting={del.isPending}
        error={deleteErr ?? undefined}
      />
    </GlassScreen>
  );
}
