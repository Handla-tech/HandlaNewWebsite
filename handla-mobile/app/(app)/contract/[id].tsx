import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, Linking } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { contractsApi } from '@/lib/endpoints';
import { useAuthStore } from '@/store/authStore';
import { Loading, Badge, DetailHeader, Row, Button } from '@/components/ui';
import { CONTRACT_STATUS_META, fmtDate } from '@/lib/salesMeta';
import { spacing, radius, font, useTheme, colors as staticColors } from '@/theme';
import type { Contract } from '@/types';

export default function ContractDetailScreen() {
  const { colors } = useTheme();
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

  const confirmReject = () =>
    Alert.alert('Reject contract?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => reject.mutate() },
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <DetailHeader title={c?.title ?? 'Loading…'} subtitle="Contract" onBack={() => router.back()} />

      {detail.isLoading || !c ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
            <Badge
              label={CONTRACT_STATUS_META[c.status].label}
              color={CONTRACT_STATUS_META[c.status].color}
              soft={CONTRACT_STATUS_META[c.status].soft}
            />
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
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const sectionLabel = {
  color: staticColors.textDim,
  fontSize: font.xs,
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  marginBottom: spacing.xs,
};

const cardStyle = {
  backgroundColor: staticColors.card,
  borderColor: staticColors.border,
  borderWidth: 1,
  borderRadius: radius.md,
  padding: spacing.md,
};
