// src/screens/ImportExportScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { Card, TabScreenSafeArea, Input } from '../components/UI';
import { useAppAuth } from '../context/AuthContext';
import {
  exportMaterielsCsv,
  exportConsommablesCsv,
  exportPretsCsv,
  exportMaterielsExcel,
  exportConsommablesExcel,
  exportPretsIcs,
  importMaterielsFromCsv,
} from '../lib/csvExportImport';
import { getMateriel, getConsommablesAlerte } from '../db/inventoryDb';
import { rescheduleVgpDueReminders } from '../lib/vgpNotifications';
import { rescheduleSeuilBasReminders } from '../lib/seuilNotifications';
import {
  getSecondaryApiBase,
  getSecondaryApiKey,
  setSecondaryApiBase,
  setSecondaryApiKey,
  looksLikeHttpUrl,
  getApiKeyOverride,
} from '../lib/apiEndpointStorage';
import { getResolvedApiBase } from '../config/stageStockApi';
import {
  syncFromInventoryApi,
  syncToInventoryApi,
  pushFullInventoryToApi,
  type InventorySyncEndpoint,
} from '../lib/inventoryApiSync';
import { copyInventoryBetweenServers } from '../lib/backendBridgeSync';
import { runRefreshSessionAfterInventoryPullIfRegistered } from '../lib/foregroundInventorySync';
import { useLanguage } from '../context/LanguageContext';

function secondaryEndpoint(url: string, key: string): InventorySyncEndpoint | null {
  const u = url.trim();
  if (!looksLikeHttpUrl(u)) return null;
  return { baseUrl: u.replace(/\/+$/, ''), apiKey: key.trim() || null };
}

export default function ImportExportScreen() {
  const insets = useSafeAreaInsets();
  const { can, refreshSession } = useAppAuth();
  const { t } = useLanguage();
  const exportOk = can('export_data');

  const [resolvedPrimary, setResolvedPrimary] = useState('');
  const [secondaryUrl, setSecondaryUrl] = useState('');
  const [secondaryKey, setSecondaryKey] = useState('');
  const [savingSecondary, setSavingSecondary] = useState(false);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const bottomSafePad =
    Platform.OS === 'android' ? Math.max(insets.bottom, 64) : Math.max(insets.bottom, 16);

  const loadEndpoints = useCallback(async () => {
    const [r, s, k] = await Promise.all([
      getResolvedApiBase(),
      getSecondaryApiBase(),
      getSecondaryApiKey(),
    ]);
    setResolvedPrimary(r || t('importExport.primaryUnset'));
    setSecondaryUrl(s ?? '');
    setSecondaryKey(k ?? '');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEndpoints();
    }, [loadEndpoints])
  );

  const afterImport = async () => {
    const [m, seuils] = await Promise.all([getMateriel(), getConsommablesAlerte()]);
    await rescheduleVgpDueReminders(m);
    await rescheduleSeuilBasReminders(seuils);
  };

  const afterBridgeSuccess = async () => {
    await refreshSession();
    await runRefreshSessionAfterInventoryPullIfRegistered();
    const [m, seuils] = await Promise.all([getMateriel(), getConsommablesAlerte()]);
    await rescheduleVgpDueReminders(m);
    await rescheduleSeuilBasReminders(seuils);
  };

  const saveSecondary = async () => {
    const trimmedUrl = secondaryUrl.trim();
    if (trimmedUrl && !looksLikeHttpUrl(trimmedUrl)) {
      Alert.alert(
        t('common.error'),
        t('onboarding.invalidUrlExpectedBody')
      );
      return;
    }
    setSavingSecondary(true);
    try {
      await setSecondaryApiBase(trimmedUrl || null);
      await setSecondaryApiKey(secondaryKey.trim() || null);
      await loadEndpoints();
      Alert.alert(t('importExport.savedTitle'), t('importExport.savedBody'));
    } finally {
      setSavingSecondary(false);
    }
  };

  const getPrimaryEndpoint = async (): Promise<InventorySyncEndpoint | null> => {
    const base = await getResolvedApiBase();
    if (!base || !looksLikeHttpUrl(base)) return null;
    const apiKey = await getApiKeyOverride();
    return { baseUrl: base.replace(/\/+$/, ''), apiKey: apiKey?.trim() || null };
  };

  const runBridge = async (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBridgeBusy(true);
    try {
      const r = await fn();
      if (r.ok) {
        await afterBridgeSuccess();
        Alert.alert(t('importExport.successShort'), label);
      } else {
        Alert.alert(t('common.error'), r.error ?? t('importExport.failGeneric'));
      }
    } finally {
      setBridgeBusy(false);
    }
  };

  if (!exportOk) {
    return (
      <TabScreenSafeArea style={styles.container}>
        <View style={{ padding: 20 }}>
          <Text style={{ color: Colors.textMuted }}>{t('importExport.denied')}</Text>
        </View>
      </TabScreenSafeArea>
    );
  }

  const sec = secondaryEndpoint(secondaryUrl, secondaryKey);

  return (
    <TabScreenSafeArea style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28 + bottomSafePad }}
      >
        <View style={styles.headerRow}>
          <Text style={{ fontSize: 22, color: Colors.green }}>📤</Text>
          <Text style={styles.title}>{t('importExport.title')}</Text>
        </View>

        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>{t('importExport.primarySection')}</Text>
          <Text style={styles.monoHint} selectable>
            {resolvedPrimary}
          </Text>
          <Text style={styles.hint}>
            {t('importExport.primaryHint')}
          </Text>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>{t('importExport.secondarySection')}</Text>
          <Text style={styles.hint}>{t('importExport.secondaryHint')}</Text>
          <Input
            label={t('importExport.secondaryUrlLabel')}
            value={secondaryUrl}
            onChangeText={setSecondaryUrl}
            placeholder={t('importExport.secondaryUrlPlaceholder')}
            autoCapitalize="none"
          />
          <Input
            label={t('importExport.secondaryKeyLabel')}
            value={secondaryKey}
            onChangeText={setSecondaryKey}
            placeholder={t('importExport.secondaryKeyPlaceholder')}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.syncBtn, savingSecondary && { opacity: 0.7 }]}
            onPress={() => void saveSecondary()}
            disabled={savingSecondary}
          >
            {savingSecondary ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.syncBtnText}>{t('importExport.saveSecondary')}</Text>
            )}
          </TouchableOpacity>

          {bridgeBusy ? (
            <ActivityIndicator color={Colors.green} style={{ marginTop: 16 }} />
          ) : (
            <>
              <Text style={[styles.sectionTitle, { fontSize: 13, marginTop: 16, marginBottom: 8 }]}>
                {t('importExport.fromDevice')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  style={styles.syncBtnSm}
                  onPress={() => {
                    if (!sec) {
                      Alert.alert(t('importExport.secondaryAlertTitle'), t('importExport.needSecondaryUrl'));
                      return;
                    }
                    void runBridge(t('importExport.bridgePullOk'), async () => {
                      const r = await syncFromInventoryApi(sec);
                      if (r.ok) await afterImport();
                      return r;
                    });
                  }}
                >
                  <Text style={styles.syncBtnTextSm}>{t('importExport.receiveFrom2')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.syncBtnSm}
                  onPress={() => {
                    if (!sec) {
                      Alert.alert(t('importExport.secondaryAlertTitle'), t('importExport.needSecondaryUrl'));
                      return;
                    }
                    void runBridge(t('importExport.bridgePushOk'), () =>
                      syncToInventoryApi(sec)
                    );
                  }}
                >
                  <Text style={styles.syncBtnTextSm}>{t('importExport.pushTo2')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.syncBtnSm}
                  onPress={() => {
                    if (!sec) {
                      Alert.alert(t('importExport.secondaryAlertTitle'), t('importExport.needSecondaryUrl'));
                      return;
                    }
                    Alert.alert(
                      t('importExport.sendFullTitle'),
                      t('importExport.sendFullBody'),
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                          text: t('importExport.send'),
                          onPress: () =>
                            void runBridge(t('importExport.bridgeFullOk'), () =>
                              pushFullInventoryToApi(sec)
                            ),
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.syncBtnTextSm}>{t('importExport.pushFullTo2')}</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { fontSize: 13, marginTop: 16, marginBottom: 8 }]}>
                {t('importExport.betweenServers')}
              </Text>
              <Text style={styles.hint}>{t('importExport.betweenServersHint')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  style={styles.syncBtnOutline}
                  onPress={() => {
                    if (!sec) {
                      Alert.alert(t('importExport.secondaryAlertTitle'), t('importExport.needSecondaryUrl'));
                      return;
                    }
                    void (async () => {
                      const primary = await getPrimaryEndpoint();
                      if (!primary) {
                        Alert.alert(t('importExport.primaryUnsetTitle'), t('importExport.needPrimaryNetwork'));
                        return;
                      }
                      Alert.alert(
                        t('importExport.copyToOtherTitle'),
                        t('importExport.copyToOtherBody'),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('importExport.copy'),
                            onPress: () =>
                              void runBridge(t('importExport.bridgeCopyFwdOk'), () =>
                                copyInventoryBetweenServers(primary, sec)
                              ),
                          },
                        ]
                      );
                    })();
                  }}
                >
                  <Text style={styles.syncBtnTextOutline}>{t('importExport.currentTo2')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.syncBtnOutline}
                  onPress={() => {
                    if (!sec) {
                      Alert.alert(t('importExport.secondaryAlertTitle'), t('importExport.needSecondaryUrl'));
                      return;
                    }
                    void (async () => {
                      const primary = await getPrimaryEndpoint();
                      if (!primary) {
                        Alert.alert(t('importExport.primaryUnsetTitle'), t('importExport.needPrimaryNetwork'));
                        return;
                      }
                      Alert.alert(
                        t('importExport.copyToCurrentTitle'),
                        t('importExport.copyToCurrentBody'),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('importExport.copy'),
                            onPress: () =>
                              void runBridge(t('importExport.bridgeCopyBackOk'), () =>
                                copyInventoryBetweenServers(sec, primary)
                              ),
                          },
                        ]
                      );
                    })();
                  }}
                >
                  <Text style={styles.syncBtnTextOutline}>{t('importExport.twoToCurrent')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>{t('importExport.filesSection')}</Text>
          <Text style={styles.hint}>{t('importExport.filesHint1')}</Text>
          <Text style={styles.hint}>{t('importExport.filesHint2')}</Text>
          <Text style={[styles.sectionTitle, { fontSize: 13, marginBottom: 8 }]}>{t('importExport.label.excel')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={() => exportMaterielsExcel().catch(e => Alert.alert(t('common.error'), e.message))}
            >
              <Text style={styles.syncBtnText}>{t('stock.title')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={() => exportConsommablesExcel().catch(e => Alert.alert(t('common.error'), e.message))}
            >
              <Text style={styles.syncBtnText}>{t('consumables.title')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.sectionTitle, { fontSize: 13, marginTop: 14, marginBottom: 8 }]}>{t('importExport.label.csv')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={() => exportMaterielsCsv().catch(e => Alert.alert(t('common.error'), e.message))}
            >
              <Text style={styles.syncBtnText}>{t('stock.title')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={() => exportConsommablesCsv().catch(e => Alert.alert(t('common.error'), e.message))}
            >
              <Text style={styles.syncBtnText}>{t('consumables.title')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={() => exportPretsCsv().catch(e => Alert.alert(t('common.error'), e.message))}
            >
              <Text style={styles.syncBtnText}>{t('loans.title')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.sectionTitle, { fontSize: 13, marginTop: 14, marginBottom: 8 }]}>{t('importExport.label.calendar')}</Text>
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={() => exportPretsIcs().catch(e => Alert.alert(t('common.error'), e.message))}
          >
            <Text style={styles.syncBtnText}>{t('importExport.loansOutlookIcs')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.syncBtnOutline, { marginTop: 10 }]}
            onPress={async () => {
              const r = await importMaterielsFromCsv();
              Alert.alert(t('importExport.importMatAlertTitle'), r.err ?? t('importExport.importMatLines', { n: r.ok }));
              await afterImport();
            }}
          >
            <Text style={styles.syncBtnTextOutline}>{t('importExport.importMatCsv')}</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  sectionTitle: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  hint: { color: Colors.textMuted, fontSize: 12, marginBottom: 10 },
  monoHint: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginBottom: 8,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  syncBtn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  syncBtnSm: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    flexGrow: 1,
    minWidth: '45%',
  },
  syncBtnText: { color: Colors.white, fontWeight: '600' },
  syncBtnTextSm: { color: Colors.white, fontWeight: '600', fontSize: 12, textAlign: 'center' },
  syncBtnOutline: {
    borderWidth: 1,
    borderColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexGrow: 1,
    minWidth: '45%',
  },
  syncBtnTextOutline: { color: Colors.green, fontWeight: '600', fontSize: 12, textAlign: 'center' },
});
