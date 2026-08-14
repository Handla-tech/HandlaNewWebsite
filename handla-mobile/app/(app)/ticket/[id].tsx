import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenBackground } from '@/components/glass';
import { supportApi } from '@/lib/endpoints';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge } from '@/components/ui';
import {
  STATUS_META,
  PRIORITY_META,
  STATUS_ORDER,
  PRIORITY_ORDER,
} from '@/lib/ticketMeta';
import { statusMeta } from '@/lib/salesMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import { useT } from '@/i18n';
import type { Ticket, TicketStatus, TicketPriority, TicketReply } from '@/types';

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** A single reply / the opening description rendered as a thread entry. */
function ThreadEntry({
  authorName,
  body,
  createdAt,
  mine,
  isInternal,
  isOpening,
}: {
  authorName: string;
  body: string;
  createdAt: string;
  mine: boolean;
  isInternal?: boolean;
  isOpening?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%', marginVertical: 4 }}>
      <View
        style={{
          backgroundColor: isInternal
            ? colors.accentSoft
            : mine
            ? colors.accent
            : colors.cardAlt,
          borderColor: isInternal ? colors.accentBorder : mine ? colors.accent : colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          borderBottomRightRadius: mine ? 4 : radius.lg,
          borderBottomLeftRadius: mine ? radius.lg : 4,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text
            style={{
              color: isInternal ? colors.accent : mine ? '#0a0a0a' : colors.textMuted,
              fontSize: font.xs,
              fontWeight: '700',
            }}
          >
            {authorName}
          </Text>
          {isOpening && (
            <Text style={{ color: mine ? '#0a0a0a' : colors.textDim, fontSize: 10 }}>
              {t('ticketDetail.opened')}
            </Text>
          )}
          {isInternal && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="lock-closed" size={10} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '700' }}>{t('ticketDetail.internal')}</Text>
            </View>
          )}
        </View>
        <Text
          style={{ color: isInternal ? colors.text : mine ? '#0a0a0a' : colors.text, fontSize: font.md }}
        >
          {body}
        </Text>
      </View>
      <Text
        style={{
          color: colors.textDim,
          fontSize: 10,
          marginTop: 2,
          textAlign: mine ? 'right' : 'left',
        }}
      >
        {fmtDateTime(createdAt)}
      </Text>
    </View>
  );
}

export default function TicketDetailScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = String(id);
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isStaff = useAuthStore((s) => s.isStaff());

  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const detail = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: (): Promise<Ticket> => supportApi.getTicket(ticketId).then((r) => r.data.data),
    enabled: !!ticketId,
  });

  const ticket: Ticket | undefined = detail.data;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
    qc.invalidateQueries({ queryKey: ['tickets'] });
    qc.invalidateQueries({ queryKey: ['supportStats'] });
  };

  const reply = useMutation({
    mutationFn: () =>
      supportApi
        .addReply(ticketId, { body: body.trim(), isInternal: isStaff ? internal : undefined })
        .then((r) => r.data.data),
    onSuccess: () => {
      setBody('');
      setInternal(false);
      invalidate();
    },
  });

  const patch = useMutation({
    mutationFn: (data: { status?: TicketStatus; priority?: TicketPriority }) =>
      supportApi.updateTicket(ticketId, data).then((r) => r.data.data),
    onSuccess: invalidate,
  });

  useEffect(() => {
    if (ticket?.replies?.length) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [ticket?.replies?.length]);

  const isClosed = ticket?.status === 'CLOSED';
  const canSend = body.trim().length > 0 && !reply.isPending && !isClosed;

  return (
    <ScreenBackground>
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
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
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.accent, fontSize: font.xs, fontWeight: '700' }}>
            {ticket?.ticketNumber ?? t('ticketDetail.fallback')}
          </Text>
          <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }} numberOfLines={1}>
            {ticket?.subject ?? t('ticketDetail.loading')}
          </Text>
        </View>
      </View>

      {detail.isLoading || !ticket ? (
        <Loading />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.lg }}
            showsVerticalScrollIndicator={false}
          >
            {/* Meta card */}
            <View
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {(() => {
                  const m = statusMeta(STATUS_META, ticket.status, t);
                  return <Badge label={m.label} color={m.color} soft={m.soft} />;
                })()}
                <Badge
                  label={t(`status.${ticket.priority}`)}
                  color={PRIORITY_META[ticket.priority].color}
                  soft={PRIORITY_META[ticket.priority].soft}
                />
                <Badge
                  label={t(`category.${ticket.category}`)}
                  color={colors.textMuted}
                  soft={colors.cardAlt}
                />
                {ticket.slaBreached && (
                  <Badge label={t('ticketDetail.slaBreach')} color={colors.danger} soft={colors.dangerSoft} />
                )}
              </View>
              {isStaff && ticket.client ? (
                <Text style={{ color: colors.textFaint, fontSize: font.sm, marginTop: spacing.sm }}>
                  {ticket.client.company || ticket.client.user?.name}
                </Text>
              ) : null}
            </View>

            {/* Staff controls */}
            {isStaff && (
              <View style={{ marginBottom: spacing.md }}>
                <Text
                  style={{
                    color: colors.textDim,
                    fontSize: font.xs,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: spacing.xs,
                  }}
                >
                  {t('ticketDetail.status')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                  {STATUS_ORDER.map((s) => {
                    const active = ticket.status === s;
                    const m = STATUS_META[s];
                    return (
                      <Pressable
                        key={s}
                        disabled={patch.isPending}
                        onPress={() => !active && patch.mutate({ status: s })}
                        style={{
                          borderRadius: radius.pill,
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm - 2,
                          borderWidth: 1,
                          borderColor: active ? m.color : colors.border,
                          backgroundColor: active ? m.soft : colors.cardAlt,
                        }}
                      >
                        <Text
                          style={{
                            color: active ? m.color : colors.textMuted,
                            fontSize: font.sm,
                            fontWeight: active ? '700' : '500',
                          }}
                        >
                          {t(`status.${s}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text
                  style={{
                    color: colors.textDim,
                    fontSize: font.xs,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginTop: spacing.md,
                    marginBottom: spacing.xs,
                  }}
                >
                  {t('ticketDetail.priority')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                  {PRIORITY_ORDER.map((p) => {
                    const active = ticket.priority === p;
                    const m = PRIORITY_META[p];
                    return (
                      <Pressable
                        key={p}
                        disabled={patch.isPending}
                        onPress={() => !active && patch.mutate({ priority: p })}
                        style={{
                          borderRadius: radius.pill,
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm - 2,
                          borderWidth: 1,
                          borderColor: active ? m.color : colors.border,
                          backgroundColor: active ? m.soft : colors.cardAlt,
                        }}
                      >
                        <Text
                          style={{
                            color: active ? m.color : colors.textMuted,
                            fontSize: font.sm,
                            fontWeight: active ? '700' : '500',
                          }}
                        >
                          {t(`status.${p}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Thread: opening description first, then replies. */}
            <ThreadEntry
              authorName={ticket.reporter?.name ?? t('ticketDetail.reporter')}
              body={ticket.description}
              createdAt={ticket.createdAt}
              mine={ticket.reporterId === user?.id}
              isOpening
            />
            {(ticket.replies ?? []).map((r: TicketReply) => (
              <ThreadEntry
                key={r.id}
                authorName={r.author?.name ?? r.authorName ?? t('ticketDetail.unknown')}
                body={r.body}
                createdAt={r.createdAt}
                mine={r.authorId === user?.id}
                isInternal={r.isInternal}
              />
            ))}
          </ScrollView>

          {/* Composer */}
          {isClosed ? (
            <View
              style={{
                padding: spacing.md,
                borderTopColor: colors.border,
                borderTopWidth: 1,
                backgroundColor: colors.surface,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.textFaint, fontSize: font.sm }}>
                {t('ticketDetail.closedNotice')}
              </Text>
            </View>
          ) : (
            <View
              style={{
                borderTopColor: colors.border,
                borderTopWidth: 1,
                backgroundColor: colors.surface,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              {isStaff && (
                <Pressable
                  onPress={() => setInternal((v) => !v)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    alignSelf: 'flex-start',
                    marginBottom: spacing.sm,
                  }}
                >
                  <Ionicons
                    name={internal ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={internal ? colors.accent : colors.textDim}
                  />
                  <Text style={{ color: internal ? colors.accent : colors.textMuted, fontSize: font.sm }}>
                    {t('ticketDetail.internalNote')}
                  </Text>
                </Pressable>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder={internal ? t('ticketDetail.internalPlaceholder') : t('ticketDetail.replyPlaceholder')}
                  placeholderTextColor={colors.textDim}
                  multiline
                  style={{
                    flex: 1,
                    maxHeight: 120,
                    minHeight: 44,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: internal ? colors.accentBorder : colors.border,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    color: colors.text,
                    paddingHorizontal: spacing.md,
                    paddingTop: 10,
                    fontSize: font.md,
                  }}
                />
                <Pressable
                  onPress={() => reply.mutate()}
                  disabled={!canSend}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: canSend ? colors.accent : colors.cardAlt,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {reply.isPending ? (
                    <ActivityIndicator color="#0a0a0a" />
                  ) : (
                    <Ionicons name="send" size={18} color={canSend ? '#0a0a0a' : colors.textDim} />
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
    </ScreenBackground>
  );
}
