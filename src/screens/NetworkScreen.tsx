import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Shadow } from '../theme/colors';
import { Card, Input, ScreenHeader, TabScreenSafeArea } from '../components/UI';
import {
  clearAllApiEndpointOverrides,
  getApiBaseOverride,
  getApiKeyOverride,
  getHealthPathOverride,
  looksLikeHttpUrl,
  setApiBaseOverride,
  setApiKeyOverride,
  setHealthPathOverride,
} from '../lib/apiEndpointStorage';
import * as Network from 'expo-network';
import { discoverStageStockOnLan, privateSubnetPrefixForIpv4 } from '../lib/lanDiscovery';
import {
  getBundledDefaultApiBase,
  getResolvedApiBase,
  probeStageStockSyncApi,
  pingStageStockApi,
} from '../config/stageStockApi';
import { GuideReseauLocalContent, GuideReseauPublicContent } from '../content/guideReseauLocal';
import { isConsumerApp } from '../config/appMode';
import { useConnection } from '../context/ConnectionContext';
import { connectionSurfaceLabel } from '../lib/urlDisplay';
import { NetworkCloudSync } from '../components/NetworkCloudSync';
import { WindowsInstallerCard } from '../components/WindowsInstallerCard';

type Segment = 'config' | 'guide';

export default function NetworkScreen() {
  const insets = useSafeAreaInsets();
  const { status, refresh } = useConnection();
  const [segment, setSegment] = useState<Segment>('config');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [healthPath, setHealthPath] = useState('');
  const [bundled, setBundled] = useState('');
  const [resolved, setResolved] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingSync, setTestingSync] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  /** Mode grand public : afficher URL / clé / tests comme sur l’écran Réseau complet */
  const [showManualServer, setShowManualServer] = useState(false);

  const refreshMeta = useCallback(async () => {
    const [b, r, baseO, keyO, healthO] = await Promise.all([
      Promise.resolve(getBundledDefaultApiBase()),
      getResolvedApiBase(),
      getApiBaseOverride(),
      getApiKeyOverride(),
      getHealthPathOverride(),
    ]);
    setBundled(b);
    setResolved(r);
    setBaseUrl(baseO ?? '');
    setApiKey(keyO ?? '');
    setHealthPath(healthO ?? '');
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshMeta();
    }, [refreshMeta])
  );

  const onSave = async () => {
    const trimmed = baseUrl.trim();
    if (trimmed && !looksLikeHttpUrl(trimmed)) {
      Alert.alert(
        'URL invalide',
        'L’adresse doit commencer par http:// ou https:// (ex. http://192.168.1.20:3000). Laissez vide pour utiliser l’URL du build (.env / EAS) si elle est définie.'
      );
      return;
    }
    setSaving(true);
    try {
      await setApiBaseOverride(trimmed || null);
      await setApiKeyOverride(apiKey.trim() || null);
      await setHealthPathOverride(healthPath.trim() || null);
      await refreshMeta();
      Alert.alert('Enregistré', 'Les réglages réseau ont été mis à jour.');
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    Alert.alert(
      'Réinitialiser',
      'Supprimer l’URL locale, la clé et le chemin de santé personnalisés ? L’application reprendra l’URL du build.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await clearAllApiEndpointOverrides();
              await refreshMeta();
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const onTest = async () => {
    setTesting(true);
    try {
      const r = await pingStageStockApi();
      Alert.alert(r.ok ? 'Connexion OK' : 'Échec du test', r.message);
    } finally {
      setTesting(false);
    }
  };

  const onTestSync = async () => {
    setTestingSync(true);
    try {
      const r = await probeStageStockSyncApi();
      Alert.alert(r.ok ? 'Sync API OK' : 'Sync API indisponible', r.message);
    } finally {
      setTestingSync(false);
    }
  };

  const onDiscoverLan = async () => {
    setDiscovering(true);
    try {
      let preferredSubnetPrefixes: string[] = [];
      try {
        const ip = await Network.getIpAddressAsync();
        if (ip && ip !== '0.0.0.0') {
          const p = privateSubnetPrefixForIpv4(ip);
          if (p) preferredSubnetPrefixes = [p];
        }
      } catch {
        /* ignore */
      }
      const hit = await discoverStageStockOnLan({ preferredSubnetPrefixes });
      if (!hit) {
        Alert.alert(
          'Aucun serveur detecte',
          'Aucun endpoint Stage Stock n a repondu sur le reseau local. Verifiez le backend, le pare-feu Windows et le Wi-Fi.'
        );
        return;
      }
      await setApiBaseOverride(hit.baseUrl);
      await refreshMeta();
      void refresh();
      if (isConsumerApp()) {
        Alert.alert('Connexion', 'Un serveur a été détecté sur votre réseau. La connexion est mise à jour.');
      } else {
        Alert.alert(
          'Serveur detecte',
          `URL appliquee:\n${hit.baseUrl}\n\nSante:\n${hit.healthUrl}\n\n${hit.note}`
        );
      }
    } finally {
      setDiscovering(false);
    }
  };

  const onOpenPairingQrPage = useCallback(async () => {
    const base = (resolved || '').trim().replace(/\/+$/, '');
    if (!base) {
      Alert.alert(
        'Serveur requis',
        'Aucune URL serveur configurée. Détectez un serveur Wi‑Fi ou saisissez son URL, puis réessayez.'
      );
      return;
    }
    const pairUrl = `${base}/pair.html`;
    try {
      const ok = await Linking.canOpenURL(pairUrl);
      if (!ok) {
        Alert.alert('Ouverture impossible', pairUrl);
        return;
      }
      await Linking.openURL(pairUrl);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
    }
  }, [resolved]);

  if (isConsumerApp()) {
    const modeLabel = connectionSurfaceLabel(resolved || getBundledDefaultApiBase());
    const stateLabel =
      status === 'checking' ? 'Vérification…' : status === 'ok' ? 'Connecté au service' : 'Hors ligne';
    return (
      <TabScreenSafeArea style={styles.container} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <ScreenHeader icon={<Text style={{ fontSize: 22 }}>📶</Text>} title="Connexion" />

          <WindowsInstallerCard />

          <View style={styles.segmentRow}>
            <TouchableOpacity
              style={[styles.segmentBtn, segment === 'config' && styles.segmentBtnActive]}
              onPress={() => setSegment('config')}
            >
              <Text style={[styles.segmentLabel, segment === 'config' && styles.segmentLabelActive]}>État</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, segment === 'guide' && styles.segmentBtnActive]}
              onPress={() => setSegment('guide')}
            >
              <Text style={[styles.segmentLabel, segment === 'guide' && styles.segmentLabelActive]}>Aide</Text>
            </TouchableOpacity>
          </View>

          {segment === 'config' ? (
            <>
              <Card style={{ marginBottom: 14 }}>
                <Text style={styles.cardTitle}>Service Stage Stock</Text>
                <Text style={styles.hintMuted}>Type de liaison (sans adresse technique)</Text>
                <Text style={styles.mono}>{modeLabel}</Text>
                <Text style={[styles.cardTitle, { marginTop: 14 }]}>État actuel</Text>
                <Text style={styles.mono}>{stateLabel}</Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={async () => {
                    await refresh();
                    await refreshMeta();
                  }}
                >
                  <Text style={styles.primaryBtnText}>Réessayer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} disabled={discovering} onPress={onDiscoverLan}>
                  {discovering ? (
                    <ActivityIndicator color={Colors.green} />
                  ) : (
                    <Text style={styles.secondaryBtnText}>Chercher un serveur sur le Wi‑Fi</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => setShowManualServer(v => !v)}
                >
                  <Text style={styles.secondaryBtnText}>
                    {showManualServer ? 'Masquer la saisie manuelle' : 'Saisie manuelle de l’URL du serveur'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={onOpenPairingQrPage}>
                  <Text style={styles.secondaryBtnText}>Ouvrir la page de jumelage (/pair.html)</Text>
                </TouchableOpacity>
              </Card>

              {showManualServer ? (
                <Card style={{ marginBottom: 14 }}>
                  <Text style={styles.cardTitle}>Adresse du serveur (réseau local)</Text>
                  <Text style={styles.hint}>
                    Indiquez l’URL fournie par votre administrateur, par ex. http://192.168.1.10:3847 (même Wi‑Fi que
                    ce téléphone). Pas besoin de slash final.
                  </Text>
                  <Input
                    label="URL de base de l’API"
                    value={baseUrl}
                    onChangeText={setBaseUrl}
                    placeholder="ex. http://192.168.1.20:3847"
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <Input
                    label="Clé API (optionnel)"
                    value={apiKey}
                    onChangeText={setApiKey}
                    placeholder="Si le serveur affiche une clé sur le PC"
                    autoCapitalize="none"
                    secureTextEntry
                  />
                  <Input
                    label="Chemin de santé (optionnel)"
                    value={healthPath}
                    onChangeText={setHealthPath}
                    placeholder="Laisser vide sauf cas particulier"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={styles.primaryBtn} disabled={saving} onPress={onSave}>
                    {saving ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <Text style={styles.primaryBtnText}>Enregistrer</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} disabled={testing} onPress={onTest}>
                    {testing ? (
                      <ActivityIndicator color={Colors.green} />
                    ) : (
                      <Text style={styles.secondaryBtnText}>Tester la connexion</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} disabled={discovering} onPress={onDiscoverLan}>
                    {discovering ? (
                      <ActivityIndicator color={Colors.green} />
                    ) : (
                      <Text style={styles.secondaryBtnText}>Chercher à nouveau sur le Wi‑Fi</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerOutline} disabled={saving} onPress={onReset}>
                    <Text style={styles.dangerOutlineText}>Réinitialiser l’URL personnalisée</Text>
                  </TouchableOpacity>
                </Card>
              ) : null}
              <NetworkCloudSync />
            </>
          ) : (
            <Card style={{ marginBottom: 14 }}>
              <GuideReseauPublicContent />
            </Card>
          )}
        </ScrollView>
      </TabScreenSafeArea>
    );
  }

  return (
    <TabScreenSafeArea style={styles.container} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <ScreenHeader icon={<Text style={{ fontSize: 22 }}>📡</Text>} title="Réseau & serveur local" />

        <WindowsInstallerCard />

        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segmentBtn, segment === 'config' && styles.segmentBtnActive]}
            onPress={() => setSegment('config')}
          >
            <Text style={[styles.segmentLabel, segment === 'config' && styles.segmentLabelActive]}>
              Configuration
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, segment === 'guide' && styles.segmentBtnActive]}
            onPress={() => setSegment('guide')}
          >
            <Text style={[styles.segmentLabel, segment === 'guide' && styles.segmentLabelActive]}>
              Mode d’emploi
            </Text>
          </TouchableOpacity>
        </View>

        {segment === 'config' ? (
          <>
            <Card style={{ marginBottom: 14 }}>
              <Text style={styles.cardTitle}>URL effective</Text>
              <Text selectable style={styles.mono}>
                {resolved || '—'}
              </Text>
              <Text style={styles.hintMuted}>
                Valeur du build (sans surcharge) :{' '}
                <Text selectable style={styles.monoSmall}>
                  {bundled}
                </Text>
              </Text>
            </Card>

            <Card style={{ marginBottom: 14 }}>
              <Text style={styles.cardTitle}>Surcharge sur cet appareil</Text>
              <Text style={styles.hint}>
                Laissez l’URL vide pour utiliser l’adresse définie au build (EXPO_PUBLIC_API_URL) si elle existe. Renseignez
                une URL http(s) pour pointer vers un PC sur le Wi‑Fi du théâtre ou un serveur accessible.
              </Text>
              <Input
                label="URL de base de l’API (optionnel)"
                value={baseUrl}
                onChangeText={setBaseUrl}
                placeholder="ex. http://192.168.1.20:3000"
                autoCapitalize="none"
                keyboardType="url"
              />
              <Input
                label="Clé API (optionnel)"
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="Si le serveur exige X-API-Key / Bearer"
                autoCapitalize="none"
                secureTextEntry
              />
              <Input
                label="Chemin de santé (optionnel)"
                value={healthPath}
                onChangeText={setHealthPath}
                placeholder="ex. /health ou /api/status"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.primaryBtn} disabled={saving} onPress={onSave}>
                {saving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} disabled={testing} onPress={onTest}>
                {testing ? (
                  <ActivityIndicator color={Colors.green} />
                ) : (
                  <Text style={styles.secondaryBtnText}>Tester la connexion</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} disabled={discovering} onPress={onDiscoverLan}>
                {discovering ? (
                  <ActivityIndicator color={Colors.green} />
                ) : (
                  <Text style={styles.secondaryBtnText}>Auto-détecter le serveur (LAN)</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} disabled={testingSync} onPress={onTestSync}>
                {testingSync ? (
                  <ActivityIndicator color={Colors.green} />
                ) : (
                  <Text style={styles.secondaryBtnText}>Tester endpoint sync</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={onOpenPairingQrPage}>
                <Text style={styles.secondaryBtnText}>Ouvrir la page de jumelage (/pair.html)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerOutline} disabled={saving} onPress={onReset}>
                <Text style={styles.dangerOutlineText}>Réinitialiser les surcharges</Text>
              </TouchableOpacity>
            </Card>
            <NetworkCloudSync />
          </>
        ) : (
          <Card style={{ marginBottom: 14 }}>
            <GuideReseauLocalContent />
          </Card>
        )}
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20 },
  segmentRow: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
  },
  segmentBtnActive: { backgroundColor: Colors.greenBg },
  segmentLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600', letterSpacing: 0.15 },
  segmentLabelActive: { color: Colors.green },
  cardTitle: { color: Colors.white, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  mono: { color: Colors.textSecondary, fontSize: 13, marginBottom: 10 },
  monoSmall: { color: Colors.textMuted, fontSize: 12 },
  hintMuted: { color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    ...Shadow.card,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: Colors.greenMuted,
  },
  secondaryBtnText: { color: Colors.green, fontWeight: '600', fontSize: 15 },
  dangerOutline: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dangerOutlineText: { color: Colors.red, fontWeight: '600', fontSize: 14 },
});
