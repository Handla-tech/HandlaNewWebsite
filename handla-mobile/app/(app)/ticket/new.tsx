import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supportApi, clientsApi } from '@/lib/endpoints';
import { useAuthStore } from '@/store/authStore';
import { Input, Button, Label } from '@/components/ui';
import {
  PRIORITY_META,
  CATEGORY_LABEL,
  PRIORITY_ORDER,
  CATEGORY_ORDER,
} from '@/lib/ticketMeta';
import { spacing, radius, font, useTheme, colors as staticColors } from '@/theme';
import type { PaginatedClients, TicketPriority, TicketCategory, Client } from '@/types';

function PillRow<T extends string>({
  options,
  value,
  onChange,
  labels,
  colorFor,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
  colorFor?: (v: T) => { color: string; soft: string };
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {options.map((o) => {
        const active = value === o;
        const c = colorFor?.(o);
        const activeColor = c?.color ?? staticColors.accent;
        const activeSoft = c?.soft ?? staticColors.accentSoft;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={{
              borderRadius: radius.pill,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm - 2,
              borderWidth: 1,
              borderColor: active ? activeColor : staticColors.border,
              backgroundColor: active ? activeSoft : staticColors.cardAlt,
            }}
          >
            <Text
              style={{
                color: active ? activeColor : staticColors.textMuted,
                fontSize: font.sm,
                fontWeight: active ? '700' : '500',
              }}
            >
              {labels[o]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function NewTicketScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const isStaff = useAuthStore((s) => s.isStaff());

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [category, setCategory] = useState<TicketCategory>('QUESTION');
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clients = useQuery({
    queryKey: ['clients', 'picker'],
    enabled: isStaff,
    queryFn: (): Promise<PaginatedClients> =>
      clientsApi.list({ limit: 100 }).then((r) => r.data.data),
  });

  const selectedClient = clients.data?.clients.find((c: Client) => c.id === clientId);

  const create = useMutation({
    mutationFn: () =>
      supportApi
        .createTicket({
          subject: subject.trim(),
          description: description.trim(),
          priority,
          category,
          ...(isStaff && clientId ? { clientId } : {}),
        })
        .then((r) => r.data.data),
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['supportStats'] });
      router.replace(`/(app)/ticket/${ticket.id}`);
    },
    onError: () => setError('Could not create the ticket. Please try again.'),
  });

  const submit = () => {
    setError(null);
    if (subject.trim().length < 2) return setError('Subject is required.');
    if (description.trim().length < 1) return setError('Description is required.');
    if (isStaff && !clientId) return setError('Please select a client.');
    create.mutate();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '700' }}>New Ticket</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Client picker (staff only) */}
          {isStaff && (
            <View style={{ marginBottom: spacing.md }}>
              <Label style={{ marginBottom: spacing.xs }}>Client</Label>
              <Pressable
                onPress={() => setClientPickerOpen((v) => !v)}
                style={{
                  minHeight: 48,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  paddingHorizontal: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: selectedClient ? colors.text : colors.textDim, fontSize: font.md }}>
                  {selectedClient
                    ? selectedClient.company || selectedClient.user?.name || 'Client'
                    : 'Select a client…'}
                </Text>
                <Ionicons
                  name={clientPickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textDim}
                />
              </Pressable>
              {clientPickerOpen && (
                <View
                  style={{
                    marginTop: spacing.xs,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    maxHeight: 240,
                  }}
                >
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {(clients.data?.clients ?? []).map((c: Client) => (
                      <Pressable
                        key={c.id}
                        onPress={() => {
                          setClientId(c.id);
                          setClientPickerOpen(false);
                        }}
                        style={{
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm,
                          borderBottomColor: colors.border,
                          borderBottomWidth: 1,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: font.md }}>
                          {c.company || c.user?.name || 'Client'}
                        </Text>
                        {c.user?.name && c.company ? (
                          <Text style={{ color: colors.textFaint, fontSize: font.xs }}>
                            {c.user.name}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                    {clients.data && clients.data.clients.length === 0 && (
                      <Text style={{ color: colors.textFaint, padding: spacing.md }}>
                        No clients available.
                      </Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          <Input
            label="Subject"
            value={subject}
            onChangeText={setSubject}
            placeholder="Brief summary of the issue"
            maxLength={255}
          />

          <Label style={{ marginBottom: spacing.xs }}>Description</Label>
          <View style={{ marginBottom: spacing.md }}>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue in detail…"
              multiline
              style={{ minHeight: 120, paddingTop: 12, textAlignVertical: 'top' }}
            />
          </View>

          <Label style={{ marginBottom: spacing.xs }}>Priority</Label>
          <View style={{ marginBottom: spacing.md }}>
            <PillRow
              options={PRIORITY_ORDER}
              value={priority}
              onChange={setPriority}
              labels={Object.fromEntries(
                PRIORITY_ORDER.map((p) => [p, PRIORITY_META[p].label]),
              ) as Record<TicketPriority, string>}
              colorFor={(p) => ({ color: PRIORITY_META[p].color, soft: PRIORITY_META[p].soft })}
            />
          </View>

          <Label style={{ marginBottom: spacing.xs }}>Category</Label>
          <View style={{ marginBottom: spacing.lg }}>
            <PillRow
              options={CATEGORY_ORDER}
              value={category}
              onChange={setCategory}
              labels={CATEGORY_LABEL}
            />
          </View>

          {error ? (
            <Text style={{ color: colors.danger, fontSize: font.sm, marginBottom: spacing.md }}>
              {error}
            </Text>
          ) : null}

          <Button title="Create Ticket" onPress={submit} loading={create.isPending} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
