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
import { useT } from '@/i18n';

export default function ContractDetailScreen() {
  const { t } = useT();
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
    queryFn: (): Promise<Contract> =>
      contractsApi.get(contractId).then((r) => r.data.data.contract),
    enabled: !!contractId,
  });
  const c: Contract | undefined = detail.data;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['contract', contractId] });
    qc.invalidateQueries({ queryKey: ['contracts'] });
  };

  const accept = useMutation({
    mutationFn: () => contractsApi.accept(contractId).then((r) => r.data.data.contract),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: () => contractsApi.reject(contractId).then((r) => r.data.data.contract),
    onSuccess: invalidate,
  });
  const send = useMutation({
    mutationFn: () => contractsApi.send(contractId).then((r) => r.data.data.contract),
    onSuccess: invalidate,
    onError: (e: any) =>
      Alert.alert(t('contract.sendError'), e?.response?.data?.message ?? t('common.tryAgain')),
  });
  const del = useMutation({
    mutationFn: () => contractsApi.remove(contractId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      router.back();
    },
    onError: (e: any) =>
      Alert.alert(t('contract.deleteError'), e?.response?.data?.message ?? t('common.tryAgain')),
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
    onError: (e) => setEditErr(apiError(e, t('detail.editSaveError'))),
  });

  const submitEdit = () => {
    if (eTitle.trim().length < 2) return setEditErr(t('detail.titleError'));
    if (eBody.trim().length < 1) return setEditErr(t('contract.bodyError'));
    setEditErr(null);
    edit.mutate();
  };

  const confirmReject = () =>
    Alert.alert(t('contract.confirmRejectTitle'), t('contract.confirmRejectMsg'), [
      { text: t('detail.cancel'), style: 'cancel' },
      { text: t('detail.reject'), style: 'destructive', onPress: () => reject.mutate() },
    ]);
  const confirmSend = () =>
    Alert.alert(t('contract.confirmSendTitle'), t('contract.confirmSendMsg'), [
      { text: t('detail.cancel'), style: 'cancel' },
      { text: t('detail.send'), onPress: () => send.mutate() },
    ]);
  const confirmDelete = () =>
    Alert.alert(t('contract.confirmDeleteTitle'), t('contract.confirmDeleteMsg'), [
      { text: t('detail.cancel'), style: 'cancel' },
      { text: t('detail.delete'), style: 'destructive', onPress: () => del.mutate() },
    ]);

  // A formal PDF/HTML document only exists once it has been generated
  // (typically at signing). Until then there is no s3Key, so the pdf-url
  // endpoint would 404 — the readable contract body below is the source of
  // truth in that case.
  const hasDocument = !!(c?.s3Key || c?.pdfUrl);

  const openDocument = async () => {
    if (!hasDocument) {
      Alert.alert(t('contract.noDocTitle'), t('contract.noDocMsg'));
      return;
    }
    try {
      setOpeningDoc(true);
      const { url } = (await contractsApi.pdfUrl(contractId)).data.data;
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
      else Alert.alert(t('contract.unableOpenTitle'), t('contract.unableOpenMsg'));
    } catch {
      Alert.alert(t('contract.errorTitle'), t('contract.fetchDocError'));
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
      <DetailHeader title={c?.title ?? t('detail.loading')} subtitle={t('contract.subtitle')} onBack={() => router.back()} />

      {detail.isLoading || !c ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
            {(() => {
              const m = statusMeta(CONTRACT_STATUS_META, c.status, t);
              return <Badge label={m.label} color={m.color} soft={m.soft} />;
            })()}
          </View>

          <View style={cardStyle}>
            {isStaff && c.client ? (
              <Row label={t('detail.client')} value={c.client.company || c.client.user?.name || '—'} />
            ) : null}
            {c.sentAt ? <Row label={t('detail.sent')} value={fmtDate(c.sentAt)} /> : null}
            {c.signedAt ? <Row label={t('detail.signed')} value={fmtDate(c.signedAt)} /> : null}
            <Row label={t('detail.updated')} value={fmtDate(c.updatedAt)} />
          </View>

          {hasDocument ? (
            <View style={{ marginTop: spacing.md }}>
              <Button
                title={t('contract.viewDocument')}
                variant="ghost"
                onPress={openDocument}
                loading={openingDoc}
              />
            </View>
          ) : null}

          {/* Body — the full readable contract text (always available). */}
          <Text style={[sectionLabel, { marginTop: spacing.lg }]}>{t('contract.contractBody')}</Text>
          <View style={cardStyle}>
            <Text style={{ color: colors.text, fontSize: font.sm, lineHeight: 22 }}>
              {c.body || t('contract.noBody')}
            </Text>
          </View>
          {!hasDocument ? (
            <Text style={{ color: colors.textMuted, fontSize: font.xs, marginTop: spacing.xs }}>
              {t('contract.docAvailableAfterSign')}
            </Text>
          ) : null}

          {canRespond && (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button title={t('contract.acceptSign')} onPress={() => accept.mutate()} loading={accept.isPending} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={t('detail.reject')}
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
                <Button title={t('contract.editAction')} variant="ghost" onPress={openEdit} />
              )}
              {canSend && (
                <Button title={t('contract.sendToClient')} onPress={confirmSend} loading={send.isPending} />
              )}
              {canDelete && (
                <Button
                  title={t('contract.delete')}
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
        title={t('contract.editModal')}
        onSubmit={submitEdit}
        submitting={edit.isPending}
        error={editErr ?? undefined}
      >
        <Input label={t('detail.titleLabel')} value={eTitle} onChangeText={setETitle} placeholder={t('contract.titlePlaceholder')} />
        <Textarea
          label={t('contract.bodyLabel')}
          value={eBody}
          onChangeText={setEBody}
          placeholder={t('contract.bodyPlaceholder')}
        />
      </FormModal>
    </SafeAreaView>
    </ScreenBackground>
  );
}

