import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, Linking } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenBackground } from '@/components/glass';
import { contractsApi, type ContractInput } from '@/lib/endpoints';
import { apiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge, DetailHeader, Row, Button, Input } from '@/components/ui';
import { FormModal, Textarea } from '@/components/forms';
import { CONTRACT_STATUS_META, statusMeta, fmtDate } from '@/lib/salesMeta';
import { spacing, radius, font, useTheme } from '@/theme';
import type { Contract } from '@/types';

export default function ContractDetailScreen() {
  const { colors } = useTheme();
  const sectionLabel = {
    color: colors.textDim,
    fontSize: font.xs,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  };
  const cardStyle = {
    backgroundColor: colors.glass,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  };
  const { id } = useLocalSearchParams<{ id: string }>();
  const contractId = String(id);
  const router = useRouter();
  const qc = useQueryClient();
  const isClient = useAuthStore((s) => s.isClient());
  const isStaff = useAuthStore((s) => s.isStaff());
  const [openingDoc, setOpeningDoc] = useState(false);

  const detail = useQuery({
    queryKey: ['contract', contractId],
    queryFn: (): Promise<Contract> => contractsApi.get(contractId).then((r) => r.data.data),
    enabled: !!contractId,
  });
  const c: Contract | undefined = detail.data;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['contract', contractId] });
    qc.invalidateQueries({ queryKey: ['contracts'] });
  };

  const accept = useMutation({
    mutationFn: () => contractsApi.accept(contractId).then((r) => r.data.data),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: () => contractsApi.reject(contractId).then((r) => r.data.data),
    onSuccess: invalidate,
  });
  const send = useMutation({
    mutationFn: () => contractsApi.send(contractId).then((r) => r.data.data),
    onSuccess: invalidate,
    onError: (e: any) =>
      Alert.alert('Could not send', e?.response?.data?.message ?? 'Please try again.'),
  });
  const del = useMutation({
    mutationFn: () => contractsApi.remove(contractId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      router.back();
    },
    onError: (e: any) =>
      Alert.alert('Could not delete', e?.response?.data?.message ?? 'Please try again.'),
  });

  const isAdmin = useAuthStore((s) => s.isAdmin());

  // ─── Edit (DRAFT only) ──────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eBody, setEBody] = useState('');

  const openEdit = () => {
    if (!c) return;
    setETitle(c.title);
    setEBody(c.body ?? '');
    setEditErr(null);
    setEditOpen(true);
  };

  const edit = useMutation({
    mutationFn: () => {
      const payload: ContractInput = { title: eTitle.trim(), body: eBody.trim() };
      return contractsApi.update(contractId, payload);
    },
    onSuccess: () => {
      invalidate();
      setEditOpen(false);
    },
    onError: (e) => setEditErr(apiError(e, 'Failed to save changes')),
  });

  const submitEdit = () => {
    if (eTitle.trim().length < 2) return setEditErr('Title must be at least 2 characters.');
    if (eBody.trim().length < 1) return setEditErr('Contract body is required.');
    setEditErr(null);
    edit.mutate();
  };

  const confirmReject = () =>
    Alert.alert('Reject contract?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => reject.mutate() },
    ]);
  const confirmSend = () =>
    Alert.alert('Send contract?', 'The client will be able to view and sign it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: () => send.mutate() },
    ]);
  const confirmDelete = () =>
    Alert.alert('Delete contract?', 'Only draft contracts can be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => del.mutate() },
    ]);

  const openDocument = async () => {
    try {
      setOpeningDoc(true);
      const { url } = (await contractsApi.pdfUrl(contractId)).data.data;
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
      else Alert.alert('Unable to open', 'The document link could not be opened.');
    } catch {
      Alert.alert('Error', 'Could not fetch the document link.');
    } finally {
      setOpeningDoc(false);
    }
  };

  const canRespond = isClient && c?.status === 'SENT';
  const canSend = isStaff && c?.status === 'DRAFT';
  const canEdit = isStaff && c?.status === 'DRAFT';
  const canDelete = isAdmin && c?.status === 'DRAFT';

  return (
    <ScreenBackground>
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <DetailHeader title={c?.title ?? 'Loading…'} subtitle="Contract" onBack={() => router.back()} />

      {detail.isLoading || !c ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
            {(() => {
              const m = statusMeta(CONTRACT_STATUS_META, c.status);
              return <Badge label={m.label} color={m.color} soft={m.soft} />;
            })()}
          </View>

          <View style={cardStyle}>
            {isStaff && c.client ? (
              <Row label="Client" value={c.client.company || c.client.user?.name || '—'} />
            ) : null}
            {c.sentAt ? <Row label="Sent" value={fmtDate(c.sentAt)} /> : null}
            {c.signedAt ? <Row label="Signed" value={fmtDate(c.signedAt)} /> : null}
            <Row label="Updated" value={fmtDate(c.updatedAt)} />
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Button
              title="View Document"
              variant="ghost"
              onPress={openDocument}
              loading={openingDoc}
            />
          </View>

          {/* Body preview */}
          <Text style={[sectionLabel, { marginTop: spacing.lg }]}>Contract Body</Text>
          <View style={cardStyle}>
            <Text style={{ color: colors.textMuted, fontSize: font.sm, lineHeight: 20 }}>
              {c.body}
            </Text>
          </View>

          {canRespond && (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button title="Accept & Sign" onPress={() => accept.mutate()} loading={accept.isPending} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Reject"
                  variant="danger"
                  onPress={confirmReject}
                  loading={reject.isPending}
                />
              </View>
            </View>
          )}

          {/* Staff workflow actions */}
          {isStaff && (canSend || canDelete || canEdit) && (
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              {canEdit && (
                <Button title="Edit contract" variant="ghost" onPress={openEdit} />
              )}
              {canSend && (
                <Button title="Send to client" onPress={confirmSend} loading={send.isPending} />
              )}
              {canDelete && (
                <Button
                  title="Delete contract"
                  variant="danger"
                  onPress={confirmDelete}
                  loading={del.isPending}
                />
              )}
            </View>
          )}
        </ScrollView>
      )}

      <FormModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Contract"
        onSubmit={submitEdit}
        submitting={edit.isPending}
        error={editErr ?? undefined}
      >
        <Input label="Title" value={eTitle} onChangeText={setETitle} placeholder="Contract title" />
        <Textarea
          label="Contract body"
          value={eBody}
          onChangeText={setEBody}
          placeholder="Terms and conditions…"
        />
      </FormModal>
    </SafeAreaView>
    </ScreenBackground>
  );
}

