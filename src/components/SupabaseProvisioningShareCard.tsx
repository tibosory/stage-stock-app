import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Colors, Shadow } from '../theme/colors';
import { Card } from './UI';
import { useLanguage } from '../context/LanguageContext';
import { useAppAuth } from '../context/AuthContext';
import { getEffectiveSupabaseConfigForShare, isSupabaseConfigured } from '../lib/supabase';
import { buildSupabaseProvisioningDeepLink } from '../lib/supabaseProvisioningDeepLink';
import { buildQrCodePreviewHtml } from '../lib/qrCodeSvg';

type Props = {
  /** Carte mise en avant en tête de l’onglet Connexion (mode Supabase). */
  prominent?: boolean;
};

export function SupabaseProvisioningShareCard({ prominent }: Props) {
  const { t } = useLanguage();
  const { can } = useAppAuth();
  const [busy, setBusy] = useState(true);
  const [link, setLink] = useState<string | null>(null);
  const [projectUrl, setProjectUrl] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const cfg = await getEffectiveSupabaseConfigForShare();
      if (!cfg) {
        setLink(null);
        setProjectUrl('');
        return;
      }
      setProjectUrl(cfg.url);
      setLink(buildSupabaseProvisioningDeepLink(cfg.url, cfg.anonKey));
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const qrHtml = useMemo(() => (link ? buildQrCodePreviewHtml(link) : null), [link]);
  const configured = isSupabaseConfigured();

  if (!can('params_sync')) return null;

  const onCopy = async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    Alert.alert(t('network.supabaseProvision.copiedTitle'), t('network.supabaseProvision.copiedBody'));
  };

  const onShareEmail = async () => {
    if (!link) return;
    const subject = encodeURIComponent(t('network.supabaseProvision.mailSubject'));
    const body = encodeURIComponent(
      t('network.supabaseProvision.mailBody', { url: projectUrl, link })
    );
    const mailUrl = `mailto:?subject=${subject}&body=${body}`;
    const ok = await Linking.canOpenURL('mailto:');
    if (!ok) {
      Alert.alert(t('common.error'), t('network.supabaseProvision.mailFail'));
      return;
    }
    await Linking.openURL(mailUrl);
  };

  const cardStyle = prominent
    ? [styles.cardProminent, !configured ? styles.cardProminentWarn : null]
    : styles.cardDefault;

  return (
    <Card style={cardStyle}>
      <View style={styles.titleRow}>
        <Text style={styles.titleIcon}>📲</Text>
        <View style={{ flex: 1 }}>
          <Text style={prominent ? styles.titleProminent : styles.cardTitle}>
            {t('network.supabaseProvision.title')}
          </Text>
          {prominent ? (
            <Text style={styles.badge}>{t('network.supabaseProvision.badge')}</Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.hint}>{t('network.supabaseProvision.hint')}</Text>
      {busy ? (
        <ActivityIndicator color={Colors.green} style={{ marginVertical: 16 }} />
      ) : !configured || !link ? (
        <Text style={styles.needConfig}>{t('network.supabaseProvision.needConfig')}</Text>
      ) : (
        <>
          <View style={[styles.qrWrap, prominent && styles.qrWrapLarge]}>
            {qrHtml ? (
              <WebView
                originWhitelist={['*']}
                source={{ html: qrHtml }}
                scrollEnabled={false}
                style={styles.qrWeb}
              />
            ) : null}
          </View>
          <Text style={styles.mono} selectable>
            {projectUrl}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => void onCopy()}>
            <Text style={styles.primaryBtnText}>{t('network.supabaseProvision.copyLink')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => void onShareEmail()}>
            <Text style={styles.secondaryBtnText}>{t('network.supabaseProvision.sendMail')}</Text>
          </TouchableOpacity>
          <Text style={styles.scanHint}>{t('network.supabaseProvision.scanHint')}</Text>
        </>
      )}
    </Card>
  );
}

/** Rappel visible en mode serveur local : basculer vers Supabase pour voir le QR. */
export function SupabaseProvisioningModeHint() {
  const { t } = useLanguage();
  const { can } = useAppAuth();
  if (!can('params_sync')) return null;
  return (
    <Card style={styles.hintCard}>
      <View style={styles.titleRow}>
        <Text style={styles.titleIcon}>📲</Text>
        <Text style={styles.cardTitle}>{t('network.supabaseProvision.switchModeTitle')}</Text>
      </View>
      <Text style={styles.hint}>{t('network.supabaseProvision.switchModeHint')}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardDefault: { marginBottom: 14 },
  cardProminent: {
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.green,
    backgroundColor: Colors.greenMuted,
    ...Shadow.card,
  },
  cardProminentWarn: {
    borderColor: Colors.yellow,
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
  },
  hintCard: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: Colors.greenMuted,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  titleIcon: { fontSize: 26, marginTop: 2 },
  cardTitle: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  titleProminent: { color: Colors.white, fontSize: 18, fontWeight: '800', lineHeight: 24 },
  badge: {
    color: Colors.green,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  needConfig: { color: Colors.yellow, fontSize: 13, lineHeight: 20 },
  scanHint: { color: Colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 10, textAlign: 'center' },
  mono: { color: Colors.textSecondary, fontSize: 12, marginBottom: 10, textAlign: 'center' },
  qrWrap: {
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    marginBottom: 12,
  },
  qrWrapLarge: {
    width: 260,
    height: 260,
  },
  qrWeb: { flex: 1, backgroundColor: 'transparent' },
  primaryBtn: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: Colors.bgCard,
  },
  secondaryBtnText: { color: Colors.green, fontWeight: '600', fontSize: 15 },
});
