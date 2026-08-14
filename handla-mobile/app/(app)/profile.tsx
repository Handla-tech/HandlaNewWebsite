import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, Title, Subtitle, Card, Button } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useT, type Locale } from '@/i18n';
import { colors, spacing, radius, font } from '@/theme';

/** Segmented EN / AR language selector. */
function LanguageSwitcher() {
  const { t, locale, setLocale } = useT();
  const options: { value: Locale; label: string }[] = [
    { value: 'en', label: t('common.languageEn') },
    { value: 'ar', label: t('common.languageAr') },
  ];

  const onSelect = async (value: Locale) => {
    if (value === locale) return;
    const directionChanged = await setLocale(value);
    if (directionChanged) {
      Alert.alert(t('rtl.restartTitle'), t('rtl.restartBody'));
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
      }}
    >
      <Ionicons name="language-outline" size={18} color={colors.accent} />
      <Text style={{ color: colors.text, fontSize: font.md, flex: 1 }}>
        {t('common.language')}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.pill,
          padding: 2,
        }}
      >
        {options.map((opt) => {
          const active = opt.value === locale;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onSelect(opt.value)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 4,
                borderRadius: radius.pill,
                backgroundColor: active ? colors.accent : 'transparent',
              }}
            >
              <Text
                style={{
                  color: active ? colors.bg : colors.textDim,
                  fontSize: font.sm,
                  fontWeight: '700',
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={{ color: colors.text, fontSize: font.md, flex: 1 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string | null }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
      }}
    >
      <Ionicons name={icon} size={18} color={colors.textDim} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textDim, fontSize: font.xs, textTransform: 'uppercase' }}>
          {label}
        </Text>
        <Text style={{ color: colors.text, fontSize: font.md, marginTop: 2 }}>
          {value || '—'}
        </Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useT();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const signOut = useAuthStore((s) => s.signOut);
  const [signingOut, setSigningOut] = React.useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    await signOut();
    // AuthGate redirects to login.
  };

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Screen scroll>
      <Title>{t('profile.title')}</Title>
      <Subtitle>{t('profile.subtitle')}</Subtitle>

      <Card style={{ marginTop: spacing.lg, alignItems: 'center' }}>
        {user?.avatarUrl ? (
          <Image
            source={{ uri: user.avatarUrl }}
            style={{ width: 72, height: 72, borderRadius: 36 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.accentSoft,
              borderWidth: 1,
              borderColor: colors.accentBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.accent, fontSize: font.xl, fontWeight: '800' }}>
              {initials}
            </Text>
          </View>
        )}
        <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: '700', marginTop: spacing.md }}>
          {user?.name}
        </Text>
        <View
          style={{
            marginTop: spacing.xs,
            backgroundColor: colors.accentSoft,
            borderColor: colors.accentBorder,
            borderWidth: 1,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: 3,
          }}
        >
          <Text style={{ color: colors.accent, fontSize: font.xs, fontWeight: '700' }}>
            {user?.role}
          </Text>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg, paddingVertical: 0 }}>
        <Row icon="mail-outline" label={t('profile.email')} value={user?.email} />
        <Row icon="call-outline" label={t('profile.phone')} value={user?.phoneNumber} />
        <Row icon="briefcase-outline" label={t('profile.jobTitle')} value={user?.jobTitle} />
        <Row icon="business-outline" label={t('profile.company')} value={user?.company} />
        <View style={{ borderBottomWidth: 0 }}>
          <Row icon="location-outline" label={t('profile.location')} value={user?.location} />
        </View>
      </Card>

      <Text
        style={{
          color: colors.textDim,
          fontSize: font.xs,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginTop: spacing.xl,
          marginBottom: spacing.xs,
        }}
      >
        {t('profile.preferences')}
      </Text>
      <Card style={{ paddingVertical: 0 }}>
        <LanguageSwitcher />
      </Card>

      {isAdmin && (
        <>
          <Text
            style={{
              color: colors.textDim,
              fontSize: font.xs,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginTop: spacing.xl,
              marginBottom: spacing.xs,
            }}
          >
            {t('profile.admin')}
          </Text>
          <Card style={{ paddingVertical: 0 }}>
            <LinkRow icon="people-outline" label={t('profile.team')} onPress={() => router.push('/(app)/team')} />
          </Card>
        </>
      )}

      <Button
        title={t('common.signOut')}
        variant="danger"
        onPress={onSignOut}
        loading={signingOut}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}
