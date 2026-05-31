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
  stripStageStockServerRootSuffix,
} from '../lib/apiEndpointStorage';
import * as Network from 'expo-network';
import { discoverStageStockOnLan, privateSubnetPrefixForIpv4 } from '../lib/lanDiscovery';
import {
  getBundledDefaultApiBase,
  getResolvedApiBase,
  probeStageStockSyncApi,
  probeAccueilProSyncApi,
  pingStageStockApi,
} from '../config/stageStockApi';
import { GuideReseauLocalContent, GuideReseauPublicContent, GuideReseauSupabaseContent } from '../content/guideReseauLocal';
import { isConsumerApp, isV1LanMode } from '../config/appMode';
import { hasLocalSyncApiKey } from '../lib/serverAuthHeaders';
import { useConnection } from '../context/ConnectionContext';
import { connectionSurfaceLabel } from '../lib/urlDisplay';
import { NetworkCloudSync } from '../components/NetworkCloudSync';
import { NetworkAccueilProSync } from '../components/NetworkAccueilProSync';
import { BackendModePicker } from '../components/BackendModePicker';
import { NetworkSupabasePanel } from '../components/NetworkSupabasePanel';
import { WindowsInstallerCard } from '../components/WindowsInstallerCard';
import { ConnectionDiagnosticPanel } from '../components/ConnectionDiagnosticPanel';
import { useLanguage } from '../context/LanguageContext';
import { toUserFriendlyNetworkMessage } from '../lib/userFriendlyNetworkError';
import { getDataBackendMode, type DataBackendMode } from '../lib/backendMode';

type Segment = 'config' | 'guide' | 'diagnostic';

export default function NetworkScreen() {
  const { t, language } = useLanguage();
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
  const [quickSetupBusy, setQuickSetupBusy] = useState(false);
  /** Mode grand public : afficher URL / clé / tests comme sur l’écran Réseau complet */
  const [showManualServer, setShowManualServer] = useState(false);
  const [backendMode, setBackendMode] = useState<DataBackendMode>('local_server');

  const isLocalBackend = isV1LanMode() || backendMode === 'local_server';

  const refreshBackendMode = useCallback(async () => {
    setBackendMode(await getDataBackendMode());
  }, []);

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
      void refreshBackendMode();
    }, [refreshMeta, refreshBackendMode])
  );

  const onSave = async () => {
    const trimmed = baseUrl.trim();
    if (trimmed && !looksLikeHttpUrl(trimmed)) {
      Alert.alert(
        t('network.invalidUrlTitle'),
        t('network.invalidUrlBody')
      );
      return;
    }
    setSaving(true);
    try {
      await setApiBaseOverride(trimmed || null);
      await setApiKeyOverride(apiKey.trim() || null);
      await setHealthPathOverride(healthPath.trim() || null);
      await refreshMeta();
      Alert.alert(t('network.saveDoneTitle'), t('network.saveDoneBody'));
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    Alert.alert(
      t('network.resetTitle'),
      t('network.resetBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('network.resetTitle'),
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
      Alert.alert(
        r.ok ? t('network.testOk') : t('network.testFail'),
        r.ok ? t('network.testOkBody') : toUserFriendlyNetworkMessage(r.message, language)
      );
    } finally {
      setTesting(false);
    }
  };

  const onTestSync = async () => {
    setTestingSync(true);
    try {
      const r = await probeStageStockSyncApi();
      Alert.alert(
        r.ok ? t('network.syncOk') : t('network.syncFail'),
        r.ok ? t('network.syncOkBody') : toUserFriendlyNetworkMessage(r.message, language)
      );
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
          t('network.noneDetectedTitle'),
          t('network.noneDetectedBody')
        );
        return;
      }
      await setApiBaseOverride(hit.baseUrl);
      await refreshMeta();
      void refresh();
      const hasKey = await hasLocalSyncApiKey();
      if (isConsumerApp()) {
        Alert.alert(
          t('network.connectionTitle'),
          hasKey ? t('network.serverDetectedConsumerBody') : t('network.serverDetectedNeedPairing')
        );
      } else {
        Alert.alert(
          t('network.serverDetectedTitle'),
          t('network.serverDetectedBody', { baseUrl: hit.baseUrl, healthUrl: hit.healthUrl, note: hit.note })
        );
      }
    } finally {
      setDiscovering(false);
    }
  };

  const onQuickSetup = async () => {
    setQuickSetupBusy(true);
    try {
      await onDiscoverLan();
      await refresh();
      await refreshMeta();
      const [ping, sync, apSync] = await Promise.all([
        pingStageStockApi(),
        probeStageStockSyncApi(),
        probeAccueilProSyncApi(),
      ]);
      if (ping.ok && sync.ok && apSync.ok) {
        Alert.alert(t('network.quickSetupOkTitle'), t('network.quickSetupOkBody'));
      } else if (ping.ok && (!sync.ok || !apSync.ok)) {
        const detail = !sync.ok ? sync.message : apSync.message;
        Alert.alert(t('network.smartDiagTitle'), t('network.smartDiagSyncFail') + '\n\n' + detail);
      } else {
        Alert.alert(t('network.quickSetupFailTitle'), t('network.quickSetupFailBody'));
      }
    } finally {
      setQuickSetupBusy(false);
    }
  };

  const onSmartDiagnose = async () => {
    setQuickSetupBusy(true);
    try {
      await refresh();
      await refreshMeta();
      const [ping, sync] = await Promise.all([pingStageStockApi(), probeStageStockSyncApi()]);
      if (ping.ok && sync.ok) {
        Alert.alert(t('network.quickSetupOkTitle'), t('network.smartDiagAllGood'));
        return;
      }
      if (ping.ok && !sync.ok) {
        Alert.alert(t('network.smartDiagTitle'), t('network.smartDiagSyncFail'));
        return;
      }
      Alert.alert(t('network.smartDiagTitle'), t('network.smartDiagServerFail'));
    } finally {
      setQuickSetupBusy(false);
    }
  };

  const onOpenPairingQrPage = useCallback(async () => {
    const base = stripStageStockServerRootSuffix((resolved || '').trim().replace(/\/+$/, ''));
    if (!base) {
      Alert.alert(
        t('network.serverRequiredTitle'),
        t('network.serverRequiredBody')
      );
      return;
    }

    const parse = (() => {
      try {
        return new URL(base);
      } catch {
        return null;
      }
    })();
    const host = parse?.hostname ?? '';
    const protocol = parse?.protocol === 'https:' ? 'https' : 'http';
    const currentPort = parse?.port ? Number(parse.port) : undefined;
    const ports = [currentPort, 8091, 8095, 3847, ...Array.from({ length: 21 }, (_, i) => 8090 + i)].filter(
      (v): v is number => Number.isFinite(v as number) && (v as number) > 0
    );
    const uniqPorts = Array.from(new Set(ports));
    const candidateBases =
      host && uniqPorts.length
        ? uniqPorts.map(p => `${protocol}://${host}:${p}`)
        : [base];

    async function firstReachablePairUrl(): Promise<string> {
      for (const b of candidateBases) {
        for (const p of ['/pair', '/pair.html']) {
          const u = `${b}${p}`;
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 2500);
            const r = await fetch(u, { method: 'GET', signal: ctrl.signal });
            clearTimeout(timer);
            if (r.status >= 200 && r.status < 500 && r.status !== 404) return u;
          } catch {
            // try next
          }
        }
      }
      return `${base}/pair`;
    }

    try {
      const pairUrl = await firstReachablePairUrl();
      // http:// LAN : canOpenURL renvoie souvent false sur Android 11+ même si le navigateur peut ouvrir l’URL.
      if (/^https:\/\//i.test(pairUrl)) {
        const ok = await Linking.canOpenURL(pairUrl);
        if (!ok) {
          Alert.alert(t('network.openError'), pairUrl);
          return;
        }
      }
      await Linking.openURL(pairUrl);
    } catch (e) {
      Alert.alert(t('network.genericError'), e instanceof Error ? e.message : String(e));
    }
  }, [resolved]);

  if (isConsumerApp()) {
    const modeLabel = connectionSurfaceLabel(resolved || getBundledDefaultApiBase());
    const stateLabel =
      status === 'checking' ? t('network.state.checking')
      : status === 'ok' ? t('network.state.connected')
      : status === 'needs_pairing' ? t('network.state.needsPairing')
      : t('network.state.offline');
    return (
      <TabScreenSafeArea style={styles.container} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <ScreenHeader icon={<Text style={{ fontSize: 22 }}>📶</Text>} title={t('network.connectionTitle')} />

          <View style={styles.segmentRow}>
            <TouchableOpacity
              style={[styles.segmentBtn, segment === 'config' && styles.segmentBtnActive]}
              onPress={() => setSegment('config')}
            >
              <Text style={[styles.segmentLabel, segment === 'config' && styles.segmentLabelActive]}>{t('network.segment.state')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, segment === 'guide' && styles.segmentBtnActive]}
              onPress={() => setSegment('guide')}
            >
              <Text style={[styles.segmentLabel, segment === 'guide' && styles.segmentLabelActive]}>{t('network.segment.help')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, segment === 'diagnostic' && styles.segmentBtnActive]}
              onPress={() => setSegment('diagnostic')}
            >
              <Text style={[styles.segmentLabel, segment === 'diagnostic' && styles.segmentLabelActive]}>{t('network.segment.diagnostic')}</Text>
            </TouchableOpacity>
          </View>

          {segment === 'config' ? (
            <>
              {!isV1LanMode() ? (
                <BackendModePicker onModeChange={setBackendMode} />
              ) : null}

              {isLocalBackend ? (
                <>
                  <WindowsInstallerCard />
                  <Card style={{ marginBottom: 14 }}>
                    <Text style={styles.cardTitle}>{t('network.backendMode.sectionLocal')}</Text>
                    <Text style={styles.hintMuted}>{t('network.backendMode.localDetail')}</Text>
                    <Text style={styles.cardTitle}>{t('network.serviceTitle')}</Text>
                    <Text style={styles.hintMuted}>{t('network.serviceHint')}</Text>
                    <Text style={styles.mono}>{modeLabel}</Text>
                    <Text style={[styles.cardTitle, { marginTop: 14 }]}>{t('network.stateTitle')}</Text>
                    <Text style={styles.mono}>{stateLabel}</Text>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={async () => {
                        await refresh();
                        await refreshMeta();
                      }}
                    >
                      <Text style={styles.primaryBtnText}>{t('network.retry')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryBtn} disabled={quickSetupBusy} onPress={onQuickSetup}>
                      {quickSetupBusy ? (
                        <ActivityIndicator color={Colors.white} />
                      ) : (
                        <Text style={styles.primaryBtnText}>{t('network.quickSetup')}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} disabled={discovering} onPress={onDiscoverLan}>
                      {discovering ? (
                        <ActivityIndicator color={Colors.green} />
                      ) : (
                        <Text style={styles.secondaryBtnText}>{t('network.searchWifi')}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} disabled={quickSetupBusy} onPress={onSmartDiagnose}>
                      {quickSetupBusy ? (
                        <ActivityIndicator color={Colors.green} />
                      ) : (
                        <Text style={styles.secondaryBtnText}>{t('network.smartDiagnose')}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => setShowManualServer(v => !v)}
                    >
                      <Text style={styles.secondaryBtnText}>
                        {showManualServer ? t('network.hideManual') : t('network.showManual')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={onOpenPairingQrPage}>
                      <Text style={styles.secondaryBtnText}>{t('network.openPairPage')}</Text>
                    </TouchableOpacity>
                  </Card>

                  {showManualServer ? (
                    <Card style={{ marginBottom: 14 }}>
                      <Text style={styles.cardTitle}>{t('network.localAddressTitle')}</Text>
                      <Text style={styles.hint}>
                        {t('network.localAddressHint')}
                      </Text>
                      <Input
                        label={t('network.field.apiBase')}
                        value={baseUrl}
                        onChangeText={setBaseUrl}
                        placeholder={t('network.field.apiBasePlaceholderLocal')}
                        autoCapitalize="none"
                        keyboardType="url"
                      />
                      <Input
                        label={t('network.field.apiKeyOptional')}
                        value={apiKey}
                        onChangeText={setApiKey}
                        placeholder={t('network.field.apiKeyPlaceholderPc')}
                        autoCapitalize="none"
                        secureTextEntry
                      />
                      <Input
                        label={t('network.field.healthPathOptional')}
                        value={healthPath}
                        onChangeText={setHealthPath}
                        placeholder={t('network.field.healthPathPlaceholderEmpty')}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity style={styles.primaryBtn} disabled={saving} onPress={onSave}>
                        {saving ? (
                          <ActivityIndicator color={Colors.white} />
                        ) : (
                          <Text style={styles.primaryBtnText}>{t('common.save')}</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.secondaryBtn} disabled={testing} onPress={onTest}>
                        {testing ? (
                          <ActivityIndicator color={Colors.green} />
                        ) : (
                          <Text style={styles.secondaryBtnText}>{t('network.testButton')}</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.secondaryBtn} disabled={discovering} onPress={onDiscoverLan}>
                        {discovering ? (
                          <ActivityIndicator color={Colors.green} />
                        ) : (
                          <Text style={styles.secondaryBtnText}>{t('network.searchWifiAgain')}</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.dangerOutline} disabled={saving} onPress={onReset}>
                        <Text style={styles.dangerOutlineText}>{t('network.resetCustomUrl')}</Text>
                      </TouchableOpacity>
                    </Card>
                  ) : null}
                </>
              ) : (
                <>
                  <Card style={{ marginBottom: 14 }}>
                    <Text style={styles.cardTitle}>{t('network.backendMode.sectionSupabase')}</Text>
                    <Text style={styles.hintMuted}>{t('network.backendMode.supabaseDetail')}</Text>
                  </Card>
                  <NetworkSupabasePanel />
                </>
              )}

              <NetworkCloudSync />
              <NetworkAccueilProSync />
            </>
          ) : segment === 'diagnostic' ? (
            <ConnectionDiagnosticPanel />
          ) : (
            <Card style={{ marginBottom: 14 }}>
              {isLocalBackend ? <GuideReseauPublicContent /> : <GuideReseauSupabaseContent />}
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
        <ScreenHeader icon={<Text style={{ fontSize: 22 }}>📡</Text>} title={t('network.serverTitle')} />

        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segmentBtn, segment === 'config' && styles.segmentBtnActive]}
            onPress={() => setSegment('config')}
          >
            <Text style={[styles.segmentLabel, segment === 'config' && styles.segmentLabelActive]}>
              {t('network.segment.config')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, segment === 'guide' && styles.segmentBtnActive]}
            onPress={() => setSegment('guide')}
          >
            <Text style={[styles.segmentLabel, segment === 'guide' && styles.segmentLabelActive]}>
              {t('network.segment.howto')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, segment === 'diagnostic' && styles.segmentBtnActive]}
            onPress={() => setSegment('diagnostic')}
          >
            <Text style={[styles.segmentLabel, segment === 'diagnostic' && styles.segmentLabelActive]}>
              {t('network.segment.diagnostic')}
            </Text>
          </TouchableOpacity>
        </View>

        {segment === 'config' ? (
          <>
            {!isV1LanMode() ? (
              <BackendModePicker onModeChange={setBackendMode} />
            ) : null}

            {isLocalBackend ? (
              <>
                <WindowsInstallerCard />
                <Card style={{ marginBottom: 14 }}>
                  <Text style={styles.cardTitle}>{t('network.backendMode.sectionLocal')}</Text>
                  <Text style={styles.hintMuted}>{t('network.backendMode.localDetail')}</Text>
                </Card>
                <Card style={{ marginBottom: 14 }}>
                  <Text style={styles.cardTitle}>{t('network.effectiveUrl')}</Text>
                  <Text selectable style={styles.mono}>
                    {resolved || t('common.dash')}
                  </Text>
                  <Text style={styles.hintMuted}>
                    {t('network.buildValueNoOverride')}{' '}
                    <Text selectable style={styles.monoSmall}>
                      {bundled}
                    </Text>
                  </Text>
                </Card>

                <Card style={{ marginBottom: 14 }}>
                  <Text style={styles.cardTitle}>{t('network.overrideThisDevice')}</Text>
                  <Text style={styles.hint}>
                    {t('network.overrideHint')}
                  </Text>
                  <Input
                    label={t('network.field.apiBaseOptional')}
                    value={baseUrl}
                    onChangeText={setBaseUrl}
                    placeholder={t('network.field.apiBasePlaceholder')}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <Input
                    label={t('network.field.apiKeyOptional')}
                    value={apiKey}
                    onChangeText={setApiKey}
                    placeholder={t('network.field.apiKeyPlaceholder')}
                    autoCapitalize="none"
                    secureTextEntry
                  />
                  <Input
                    label={t('network.field.healthPathOptional')}
                    value={healthPath}
                    onChangeText={setHealthPath}
                    placeholder={t('network.field.healthPathPlaceholder')}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={styles.primaryBtn} disabled={saving} onPress={onSave}>
                    {saving ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <Text style={styles.primaryBtnText}>{t('common.save')}</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} disabled={testing} onPress={onTest}>
                    {testing ? (
                      <ActivityIndicator color={Colors.green} />
                    ) : (
                      <Text style={styles.secondaryBtnText}>{t('network.testButton')}</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} disabled={discovering} onPress={onDiscoverLan}>
                    {discovering ? (
                      <ActivityIndicator color={Colors.green} />
                    ) : (
                      <Text style={styles.secondaryBtnText}>{t('network.autoDetectLan')}</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} disabled={testingSync} onPress={onTestSync}>
                    {testingSync ? (
                      <ActivityIndicator color={Colors.green} />
                    ) : (
                      <Text style={styles.secondaryBtnText}>{t('network.syncTestButton')}</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={onOpenPairingQrPage}>
                    <Text style={styles.secondaryBtnText}>{t('network.openPairPage')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerOutline} disabled={saving} onPress={onReset}>
                    <Text style={styles.dangerOutlineText}>{t('network.resetOverrides')}</Text>
                  </TouchableOpacity>
                </Card>
              </>
            ) : (
              <>
                <Card style={{ marginBottom: 14 }}>
                  <Text style={styles.cardTitle}>{t('network.backendMode.sectionSupabase')}</Text>
                  <Text style={styles.hintMuted}>{t('network.backendMode.supabaseDetail')}</Text>
                </Card>
                <NetworkSupabasePanel />
              </>
            )}

            <NetworkCloudSync />
            <NetworkAccueilProSync />
          </>
        ) : segment === 'diagnostic' ? (
          <ConnectionDiagnosticPanel />
        ) : (
          <Card style={{ marginBottom: 14 }}>
            {isLocalBackend ? <GuideReseauLocalContent /> : <GuideReseauSupabaseContent />}
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
