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
import { getConsommablesAlerte, getMateriel } from '../db/database';
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

function secondaryEndpoint(url: string, key: string): InventorySyncEndpoint | null {
  const u = url.trim();
  if (!looksLikeHttpUrl(u)) return null;
  return { baseUrl: u.replace(/\/+$/, ''), apiKey: key.trim() || null };
}

export default function ImportExportScreen() {
  const insets = useSafeAreaInsets();
  const { can, refreshSession } = useAppAuth();
  const exportOk = can('export_data');

  const [resolvedPrimary, setResolvedPrimary] = useState('');
  const [secondaryUrl, setSecondaryUrl] = useState('');
  const [secondaryKey, setSecondaryKey] = useState('');
  const [savingSecondary, setSavingSecondary] = useState(false);
  const [bridgeBusy, setBridgeBusy] = useState(false);

  const loadEndpoints = useCallback(async () => {
    const [r, s, k] = await Promise.all([
      getResolvedApiBase(),
      getSecondaryApiBase(),
      getSecondaryApiKey(),
    ]);
    setResolvedPrimary(r || '(non configuré — onglet Réseau)');
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
    const t = secondaryUrl.trim();
    if (t && !looksLikeHttpUrl(t)) {
      Alert.alert('URL invalide', 'Utilisez une adresse http:// ou https:// complète.');
      return;
    }
    setSavingSecondary(true);
    try {
      await setSecondaryApiBase(t || null);
      await setSecondaryApiKey(secondaryKey.trim() || null);
      await loadEndpoints();
      Alert.alert('Enregistré', 'Le serveur secondaire a été mémorisé sur cet appareil.');
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
        Alert.alert('✓', label);
      } else {
        Alert.alert('Erreur', r.error ?? 'Échec');
      }
    } finally {
      setBridgeBusy(false);
    }
  };

  if (!exportOk) {
    return (
      <TabScreenSafeArea style={styles.container}>
        <View style={{ padding: 20 }}>
          <Text style={{ color: Colors.textMuted }}>Accès non autorisé.</Text>
        </View>
      </TabScreenSafeArea>
    );
  }

  const sec = secondaryEndpoint(secondaryUrl, secondaryKey);

  return (
    <TabScreenSafeArea style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28 + Math.max(insets.bottom, 12) }}
      >
        <View style={styles.headerRow}>
          <Text style={{ fontSize: 22, color: Colors.green }}>📤</Text>
          <Text style={styles.title}>Import / export</Text>
        </View>

        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>Serveur actuel (onglet Réseau)</Text>
          <Text style={styles.monoHint} selectable>
            {resolvedPrimary}
          </Text>
          <Text style={styles.hint}>
            C’est la cible des boutons « Envoyer / Recevoir » sur l’écran Réseau. Le serveur secondaire ci‑dessous sert
            à synchroniser explicitement avec un autre hôte (ex. PC local ↔ cloud Railway).
          </Text>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>Autre serveur (local ↔ cloud)</Text>
          <Text style={styles.hint}>
            URL et clé API optionnelle si elle diffère de celle de l’onglet Réseau. Enregistrez avant les actions
            ci‑dessous.
          </Text>
          <Input
            label="URL du serveur secondaire"
            value={secondaryUrl}
            onChangeText={setSecondaryUrl}
            placeholder="https://… ou http://192.168.x.x:3847"
            autoCapitalize="none"
          />
          <Input
            label="Clé API (optionnel)"
            value={secondaryKey}
            onChangeText={setSecondaryKey}
            placeholder="Si le serveur secondaire exige une autre clé"
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
              <Text style={styles.syncBtnText}>Enregistrer le serveur secondaire</Text>
            )}
          </TouchableOpacity>

          {bridgeBusy ? (
            <ActivityIndicator color={Colors.green} style={{ marginTop: 16 }} />
          ) : (
            <>
              <Text style={[styles.sectionTitle, { fontSize: 13, marginTop: 16, marginBottom: 8 }]}>
                Depuis / vers cet appareil
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  style={styles.syncBtnSm}
                  onPress={() => {
                    if (!sec) {
                      Alert.alert('Serveur secondaire', 'Renseignez une URL valide et enregistrez.');
                      return;
                    }
                    void runBridge('Données du serveur secondaire importées dans l’app.', async () => {
                      const r = await syncFromInventoryApi(sec);
                      if (r.ok) await afterImport();
                      return r;
                    });
                  }}
                >
                  <Text style={styles.syncBtnTextSm}>↓ Recevoir depuis serveur 2</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.syncBtnSm}
                  onPress={() => {
                    if (!sec) {
                      Alert.alert('Serveur secondaire', 'Renseignez une URL valide et enregistrez.');
                      return;
                    }
                    void runBridge('Modifications envoyées vers le serveur secondaire.', () =>
                      syncToInventoryApi(sec)
                    );
                  }}
                >
                  <Text style={styles.syncBtnTextSm}>↑ Envoyer modifs → serveur 2</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.syncBtnSm}
                  onPress={() => {
                    if (!sec) {
                      Alert.alert('Serveur secondaire', 'Renseignez une URL valide et enregistrez.');
                      return;
                    }
                    Alert.alert(
                      'Envoi complet',
                      'Tout l’inventaire local sera envoyé vers le serveur secondaire (écrasement des mêmes IDs). Continuer ?',
                      [
                        { text: 'Annuler', style: 'cancel' },
                        {
                          text: 'Envoyer',
                          onPress: () =>
                            void runBridge('Inventaire complet envoyé vers le serveur secondaire.', () =>
                              pushFullInventoryToApi(sec)
                            ),
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.syncBtnTextSm}>↑ Tout envoyer → serveur 2</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { fontSize: 13, marginTop: 16, marginBottom: 8 }]}>
                Direct entre deux serveurs (sans tout stocker sur le téléphone)
              </Text>
              <Text style={styles.hint}>
                Copie l’inventaire d’une base PostgreSQL vers l’autre. Les deux URLs doivent être joignables (même
                compte JWT ou clés API valides sur chaque hôte).
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  style={styles.syncBtnOutline}
                  onPress={() => {
                    if (!sec) {
                      Alert.alert('Serveur secondaire', 'Renseignez une URL valide et enregistrez.');
                      return;
                    }
                    void (async () => {
                      const primary = await getPrimaryEndpoint();
                      if (!primary) {
                        Alert.alert('Serveur actuel', 'Configurez d’abord l’URL dans l’onglet Réseau.');
                        return;
                      }
                      Alert.alert(
                        'Copier vers le cloud / autre hôte',
                        'Le contenu du serveur actuel (Réseau) remplacera les données correspondantes sur le serveur secondaire. Continuer ?',
                        [
                          { text: 'Annuler', style: 'cancel' },
                          {
                            text: 'Copier',
                            onPress: () =>
                              void runBridge('Copie effectuée : actuel → serveur secondaire.', () =>
                                copyInventoryBetweenServers(primary, sec)
                              ),
                          },
                        ]
                      );
                    })();
                  }}
                >
                  <Text style={styles.syncBtnTextOutline}>Actuel → serveur 2</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.syncBtnOutline}
                  onPress={() => {
                    if (!sec) {
                      Alert.alert('Serveur secondaire', 'Renseignez une URL valide et enregistrez.');
                      return;
                    }
                    void (async () => {
                      const primary = await getPrimaryEndpoint();
                      if (!primary) {
                        Alert.alert('Serveur actuel', 'Configurez d’abord l’URL dans l’onglet Réseau.');
                        return;
                      }
                      Alert.alert(
                        'Copier vers le serveur actuel',
                        'Le contenu du serveur secondaire remplacera les données correspondantes sur le serveur défini dans Réseau. Continuer ?',
                        [
                          { text: 'Annuler', style: 'cancel' },
                          {
                            text: 'Copier',
                            onPress: () =>
                              void runBridge('Copie effectuée : serveur secondaire → actuel.', () =>
                                copyInventoryBetweenServers(sec, primary)
                              ),
                          },
                        ]
                      );
                    })();
                  }}
                >
                  <Text style={styles.syncBtnTextOutline}>Serveur 2 → actuel</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>Fichiers (Excel, CSV, calendrier)</Text>
          <Text style={styles.hint}>
            Excel : un onglet par catégorie. CSV : fichier simple. Calendrier : une entrée par prêt (dates départ →
            retour prévu, hors annulés) au format .ics.
          </Text>
          <Text style={styles.hint}>
            Après génération, utilisez le partage natif pour envoyer vers le cloud ou l’e-mail.
          </Text>
          <Text style={[styles.sectionTitle, { fontSize: 13, marginBottom: 8 }]}>Excel (.xlsx)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={() => exportMaterielsExcel().catch(e => Alert.alert('Erreur', e.message))}
            >
              <Text style={styles.syncBtnText}>Matériels</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={() => exportConsommablesExcel().catch(e => Alert.alert('Erreur', e.message))}
            >
              <Text style={styles.syncBtnText}>Consommables</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.sectionTitle, { fontSize: 13, marginTop: 14, marginBottom: 8 }]}>CSV</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={() => exportMaterielsCsv().catch(e => Alert.alert('Erreur', e.message))}
            >
              <Text style={styles.syncBtnText}>Matériels</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={() => exportConsommablesCsv().catch(e => Alert.alert('Erreur', e.message))}
            >
              <Text style={styles.syncBtnText}>Consommables</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={() => exportPretsCsv().catch(e => Alert.alert('Erreur', e.message))}
            >
              <Text style={styles.syncBtnText}>Prêts</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.sectionTitle, { fontSize: 13, marginTop: 14, marginBottom: 8 }]}>Calendrier</Text>
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={() => exportPretsIcs().catch(e => Alert.alert('Erreur', e.message))}
          >
            <Text style={styles.syncBtnText}>Prêts → Outlook (.ics)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.syncBtnOutline, { marginTop: 10 }]}
            onPress={async () => {
              const r = await importMaterielsFromCsv();
              Alert.alert('Import matériels', r.err ?? `${r.ok} ligne(s) importée(s).`);
              await afterImport();
            }}
          >
            <Text style={styles.syncBtnTextOutline}>Importer matériels (CSV)</Text>
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
