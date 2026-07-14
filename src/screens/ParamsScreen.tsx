// src/screens/ParamsScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Switch, ActivityIndicator, Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  getAlertesEmail, insertAlerteEmail, deleteAlerteEmail,
  getStats,
  getBeneficiaires, insertBeneficiaire, deleteBeneficiaire,
} from '../db/metadataDb';
import {
  getCategories, insertCategorie, deleteCategorie, categoryPathById,
  getLocalisations, insertLocalisation, deleteLocalisation, getLieux,
} from '../db/catalogDb';
import { getMateriel, getConsommablesAlerte } from '../db/inventoryDb';
import { getPrets } from '../db/loanDb';
import { insertAppUser, listAppUsersAll } from '../db/userDb';
import { Categorie, Localisation, Lieu, AlerteEmail, AppUser, AppUserRole, Beneficiaire } from '../types';
import { formatLieuPickerLabel } from '../lib/capiLieuxCatalog';
import { Card, Input, ScreenHeader, SelectPicker, TabScreenSafeArea } from '../components/UI';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { LegalLinksParamsCard } from '../components/LegalLinks';
import { useAppAuth } from '../context/AuthContext';
import { requestNotificationPermission, reschedulePretReturnReminders } from '../lib/pretNotifications';
import { rescheduleVgpDueReminders } from '../lib/vgpNotifications';
import { rescheduleSeuilBasReminders } from '../lib/seuilNotifications';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  loadMailRecipientAlerteIds,
  saveMailRecipientAlerteIds,
  type NotificationPrefs,
} from '../lib/notificationPrefs';
import {
  getVgpNotificationAdvanceDays,
  setVgpNotificationAdvanceDays,
  clampVgpAdvanceDays,
} from '../lib/vgpPrefs';
import { resetWorkspaceOnboardingCompleted } from '../lib/workspaceOnboardingStorage';
import { loadComfortPrefs, saveComfortPrefs, type ComfortPrefs } from '../lib/appComfortPrefs';
import {
  scheduleTestLocalNotification,
  sendTestExpoPushToStaff,
  sendTestSmtpAlertEmail,
} from '../lib/notificationTest';
import {
  getSyncQueueStats,
  purgeSyncQueueSafely,
  type SyncQueueStats,
} from '../saas/services/offlineSync';
import { useFeatureFlags } from '../saas/hooks/useFeatureFlags';
import {
  appendSyncAdminAuditEntry,
  getSyncAdminAuditEntries,
  type SyncAdminAuditEntry,
} from '../application/sync/SyncAdminAuditStore';
import { useSyncState } from '../ui/hooks/useSyncState';
import { computeSyncHealth } from '../application/sync/SyncHealth';
import { SyncService } from '../application/services/SyncService';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGE_OPTIONS, type AppLanguage } from '../i18n/strings';

const ROLE_OPTIONS: { label: string; value: AppUserRole }[] = [
  { label: 'Administrateur', value: 'admin' },
  { label: 'Technicien', value: 'technicien' },
  { label: 'Emprunteur', value: 'emprunteur' },
];

function NotifRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 }}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.border, true: Colors.greenMuted }}
        thumbColor={value ? Colors.green : Colors.textMuted}
      />
      <Text style={{ color: Colors.textSecondary, flex: 1, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

export default function ParamsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const bottomSafePad =
    Platform.OS === 'android' ? Math.max(insets.bottom, 64) : Math.max(insets.bottom, 16);
  const { can, refreshSession, user } = useAppAuth();
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [localisations, setLocalisations] = useState<Localisation[]>([]);
  const [lieux, setLieux] = useState<Lieu[]>([]);
  const [alertes, setAlertes] = useState<AlerteEmail[]>([]);
  const [stats, setStats] = useState({ totalMateriels: 0, enPret: 0, pretsEnCours: 0, alertesConsommables: 0 });

  const [newCat, setNewCat] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [newLocLieuId, setNewLocLieuId] = useState('');
  const [alertNom, setAlertNom] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertRole, setAlertRole] = useState('');

  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [nuNom, setNuNom] = useState('');
  const [nuPin, setNuPin] = useState('');
  const [nuRole, setNuRole] = useState<AppUserRole>('technicien');

  const [vgpAdvanceDays, setVgpAdvanceDaysState] = useState('7');
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    pushPrets: true,
    pushVgpControle: true,
    pushSeuilBas: true,
    pushCapiRetro: true,
    mailSuggestionSeuil: true,
    mailSuggestionVgp: true,
    mailSuggestionPrets: true,
    mailAutoSendWifiCellular: true,
  });
  const [mailRecipientIds, setMailRecipientIds] = useState<string[]>([]);
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [newBenNom, setNewBenNom] = useState('');
  const [newBenOrg, setNewBenOrg] = useState('');
  const [newBenTel, setNewBenTel] = useState('');
  const [newBenEmail, setNewBenEmail] = useState('');

  const [testMsgTitle, setTestMsgTitle] = useState('CATRACK Pro — test');
  const [testMsgBody, setTestMsgBody] = useState(
    'Vérifiez la réception des alertes et notifications.'
  );
  const [testBusy, setTestBusy] = useState<null | 'local' | 'push' | 'mail'>(null);
  const [syncQueueStats, setSyncQueueStats] = useState<SyncQueueStats | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [syncAuditEntries, setSyncAuditEntries] = useState<SyncAdminAuditEntry[]>([]);
  const syncState = useSyncState();
  const { flags: saasFlags } = useFeatureFlags();
  const [comfortPrefs, setComfortPrefs] = useState<ComfortPrefs>({ hapticOnScanMatch: true });
  const { language, setLanguage, t } = useLanguage();

  const fmt = (iso?: string): string => (iso ? new Date(iso).toLocaleString('fr-FR') : '—');
  const fmtMs = (ms?: number): string => (ms == null ? '—' : `${Math.round(ms / 1000)} s`);
  const sinceLastSuccess =
    syncState.lastSuccessAt != null
      ? Math.max(0, Math.floor((Date.now() - Date.parse(syncState.lastSuccessAt)) / 1000))
      : null;
  const syncHealth = computeSyncHealth(syncState, syncQueueStats);
  const healthColor =
    syncHealth.level === 'healthy'
      ? Colors.green
      : syncHealth.level === 'warning'
        ? Colors.yellow
        : Colors.red;

  const persistNotif = useCallback(async (partial: Partial<NotificationPrefs>) => {
    const next = await saveNotificationPrefs(partial);
    setNotifPrefs(next);
    const [prets, mats, seuils] = await Promise.all([
      getPrets(),
      getMateriel(),
      getConsommablesAlerte(),
    ]);
    await reschedulePretReturnReminders(prets);
    await rescheduleVgpDueReminders(mats);
    await rescheduleSeuilBasReminders(seuils);
  }, []);

  const load = useCallback(async () => {
    const [cats, locs, lieuRows, als, st, users, vgpAdv, bens, prefs, mids, comfort] = await Promise.all([
      getCategories(),
      getLocalisations(),
      getLieux(),
      getAlertesEmail(),
      getStats(),
      listAppUsersAll(),
      getVgpNotificationAdvanceDays(),
      getBeneficiaires(),
      loadNotificationPrefs(),
      loadMailRecipientAlerteIds(),
      loadComfortPrefs(),
    ]);
    setCategories(cats);
    setLocalisations(locs);
    setLieux(lieuRows);
    setAlertes(als);
    setBeneficiaires(bens);
    setStats(st);
    setAppUsers(users);
    setVgpAdvanceDaysState(String(vgpAdv));
    setNotifPrefs(prefs);
    setMailRecipientIds(mids);
    setComfortPrefs(comfort);
    setSyncQueueStats(await getSyncQueueStats());
    setSyncAuditEntries(await getSyncAdminAuditEntries());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshSession();
      void load();
    }, [load, refreshSession])
  );

  useEffect(() => {
    const id = setInterval(() => {
      void getSyncQueueStats().then(setSyncQueueStats).catch(() => undefined);
      void getSyncAdminAuditEntries().then(setSyncAuditEntries).catch(() => undefined);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const exportSyncDiagnostics = useCallback(async () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      queue: await getSyncQueueStats(),
      audit: await getSyncAdminAuditEntries(),
    };
    const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!dir) throw new Error('Aucun répertoire local disponible pour export');
    const path = `${dir}stagestock-sync-diagnostics-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Export diagnostics sync' });
    }
    await appendSyncAdminAuditEntry({
      action: 'export_diagnostics',
      userId: user?.id,
      summary: `Diagnostics exported to ${path}`,
    });
    setSyncAuditEntries(await getSyncAdminAuditEntries());
  }, [user?.id]);

  const copySyncSupportSummary = useCallback(async () => {
    const queue = await getSyncQueueStats();
    const audit = await getSyncAdminAuditEntries();
    const health = computeSyncHealth(syncState, queue);
    const lines = [
      'StageStock Sync Support Summary',
      `generated_at=${new Date().toISOString()}`,
      `health_score=${health.score}`,
      `health_level=${health.level}`,
      `queue_size=${queue.size}`,
      `retrying=${queue.retryingCount}`,
      `max_retries=${queue.maxRetries}`,
      `scheduler_active=${syncState.schedulerActive ? 'yes' : 'no'}`,
      `next_scheduled_at=${syncState.nextScheduledAt ?? '-'}`,
      `next_backoff_ms=${syncState.nextBackoffMs ?? '-'}`,
      `last_run_at=${syncState.lastRunAt ?? '-'}`,
      `last_success_at=${syncState.lastSuccessAt ?? '-'}`,
      `last_error_at=${syncState.lastErrorAt ?? '-'}`,
      `last_error_category=${syncState.lastErrorCategory ?? '-'}`,
      `last_error_code=${syncState.lastErrorCode ?? '-'}`,
      `last_error_message=${syncState.lastErrorMessage ?? '-'}`,
      `audit_recent=${audit
        .slice(0, 5)
        .map(a => `${a.at}:${a.action}`)
        .join('|') || '-'}`,
      `queue_by_table=${Object.entries(queue.byTable)
        .map(([k, v]) => `${k}:${v}`)
        .join('|') || '-'}`,
      `health_reasons=${health.reasons.join(' | ')}`,
    ];
    const summaryText = lines.join('\n');
    await Clipboard.setStringAsync(summaryText);
    const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (dir) {
      const txtPath = `${dir}stagestock-sync-support-${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(txtPath, summaryText, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(txtPath, { mimeType: 'text/plain', dialogTitle: 'Résumé support sync (.txt)' });
      }
    }
    await appendSyncAdminAuditEntry({
      action: 'export_diagnostics',
      userId: user?.id,
      summary: 'Support summary copied + txt exported',
    });
    setSyncAuditEntries(await getSyncAdminAuditEntries());
    Alert.alert('Résumé copié', 'Le résumé support sync est dans le presse-papier.');
  }, [syncState, user?.id]);

  const copyCompactIncidentSummary = useCallback(async () => {
    const queue = await getSyncQueueStats();
    const health = computeSyncHealth(syncState, queue);
    const compact = [
      `SYNC score=${health.score} level=${health.level}`,
      `phase=${syncState.phase} fails=${syncState.consecutiveFailures}`,
      `queue=${queue.size} retrying=${queue.retryingCount} maxRetry=${queue.maxRetries}`,
      `lastSuccess=${syncState.lastSuccessAt ?? '-'}`,
      `lastErr=${syncState.lastErrorCategory ?? '-'}:${syncState.lastErrorCode ?? '-'}:${syncState.lastErrorMessage ?? '-'}`,
    ].join(' | ');
    await Clipboard.setStringAsync(compact);
    await appendSyncAdminAuditEntry({
      action: 'export_diagnostics',
      userId: user?.id,
      summary: 'Compact incident summary copied',
    });
    setSyncAuditEntries(await getSyncAdminAuditEntries());
    Alert.alert('Résumé compact copié', 'Le résumé incident compact est dans le presse-papier.');
  }, [syncState, user?.id]);

  const addCategorie = async () => {
    if (!newCat.trim()) return;
    await insertCategorie(newCat.trim());
    setNewCat('');
    load();
  };

  const addLocalisation = async () => {
    if (!newLocLieuId.trim()) {
      Alert.alert('Lieu requis', 'Choisissez un lieu CAPI (salle, extérieur, adresse, véhicule…).');
      return;
    }
    if (!newLoc.trim()) return;
    await insertLocalisation(newLoc.trim(), newLocLieuId.trim());
    setNewLoc('');
    load();
  };

  const addAlerte = async () => {
    if (!alertEmail.trim()) {
      Alert.alert('Email requis');
      return;
    }
    await insertAlerteEmail({ nom: alertNom || undefined, email: alertEmail.trim(), role: alertRole || undefined });
    setAlertNom(''); setAlertEmail(''); setAlertRole('');
    load();
  };

  const addBeneficiaire = async () => {
    if (!newBenNom.trim()) {
      Alert.alert('Nom requis', 'Indiquez au moins le nom du bénéficiaire.');
      return;
    }
    await insertBeneficiaire({
      nom: newBenNom.trim(),
      organisation: newBenOrg.trim() || null,
      telephone: newBenTel.trim() || null,
      email: newBenEmail.trim() || null,
    });
    setNewBenNom('');
    setNewBenOrg('');
    setNewBenTel('');
    setNewBenEmail('');
    load();
  };

  const addAppUser = async () => {
    if (!nuNom.trim() || nuPin.length < 4) {
      Alert.alert('Utilisateur', 'Nom et PIN (min. 4 caractères) requis.');
      return;
    }
    await insertAppUser(nuNom.trim(), nuRole, nuPin);
    setNuNom('');
    setNuPin('');
    load();
    Alert.alert('✓', 'Utilisateur créé.');
  };

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28 + bottomSafePad }}
      >
        <ScreenHeader
          icon={<Text style={{ fontSize: 22, color: Colors.green }}>⚙️</Text>}
          title="Paramètres"
          subtitle="Comptes, catalogue, notifications, confort scanner, synchro et options avancées."
        />
        <SyncStatusBadge />

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>{t('language.title')}</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
            {t('language.subtitle')}
          </Text>
          <SelectPicker
            label={t('language.current')}
            value={language}
            options={LANGUAGE_OPTIONS}
            onChange={v => {
              void setLanguage(v as AppLanguage);
            }}
          />
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Confort (scanner)</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
            Le vibreur court reste actif à chaque lecture ; vous pouvez ajouter un retour haptique lorsque le code
            correspond à une fiche matériel ou consommable (utile en intérieur ou avec gants).
          </Text>
          <NotifRow
            label="Haptique quand une fiche est reconnue"
            value={comfortPrefs.hapticOnScanMatch}
            onValueChange={v => {
              void saveComfortPrefs({ hapticOnScanMatch: v }).then(setComfortPrefs);
            }}
          />
        </Card>

        {saasFlags['saas.offlineSync'] && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={s.sectionTitle}>Diagnostic de synchronisation</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 8 }}>
              Queue locale offline-first (synchronisation différée).
            </Text>
            <Text style={{ color: healthColor, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>
              Santé sync: {syncHealth.score}/100 ({syncHealth.level})
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 8 }}>
              {syncHealth.reasons.join(' • ')}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              Taille queue: {syncQueueStats?.size ?? 0}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              Tâches en retry: {syncQueueStats?.retryingCount ?? 0}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              Max retries: {syncQueueStats?.maxRetries ?? 0}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              Plus ancien: {syncQueueStats?.oldestUpdatedAt ?? '—'}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
              Plus récent: {syncQueueStats?.newestUpdatedAt ?? '—'}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              Scheduler actif: {syncState.schedulerActive ? 'oui' : 'non'}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              Prochain sync estimé: {fmt(syncState.nextScheduledAt)}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              Délai backoff estimé: {fmtMs(syncState.nextBackoffMs)}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              Dernier run: {fmt(syncState.lastRunAt)}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              Dernier succès: {fmt(syncState.lastSuccessAt)}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              Temps depuis dernier succès: {sinceLastSuccess == null ? '—' : `${sinceLastSuccess} s`}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              Dernière erreur: {syncState.lastErrorCategory ?? '—'} {syncState.lastErrorCode ? `(${syncState.lastErrorCode})` : ''}
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 8 }}>
              {syncState.lastErrorMessage ?? 'Aucune erreur récente'}
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
              {syncQueueStats
                ? Object.entries(syncQueueStats.byTable)
                    .map(([table, n]) => `${table}: ${n}`)
                    .join(' | ') || 'Aucune table en attente'
                : 'Aucune table en attente'}
            </Text>
            {can('manage_users') && (
              <TouchableOpacity
                style={[s.syncBtn, { marginTop: 10, opacity: purgeBusy ? 0.7 : 1 }]}
                disabled={purgeBusy}
                onPress={() => {
                  Alert.alert(
                    'Purge queue (sécurisée)',
                    'Supprimer uniquement les tâches non critiques en attente ? Les événements tracking critiques sont conservés.',
                    [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Purger',
                        style: 'destructive',
                        onPress: async () => {
                          setPurgeBusy(true);
                          try {
                            const r = await purgeSyncQueueSafely({ allowCritical: false, maxRetriesToKeep: 1 });
                            await appendSyncAdminAuditEntry({
                              action: 'purge_queue',
                              userId: user?.id,
                              summary: `removed=${r.removedCount}, kept=${r.keptCount}`,
                            });
                            setSyncQueueStats(await getSyncQueueStats());
                            setSyncAuditEntries(await getSyncAdminAuditEntries());
                            Alert.alert(
                              'Purge effectuée',
                              `Supprimées: ${r.removedCount}\nConservées: ${r.keptCount}`
                            );
                          } catch (e) {
                            Alert.alert('Erreur purge', e instanceof Error ? e.message : String(e));
                          } finally {
                            setPurgeBusy(false);
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                {purgeBusy ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={s.syncBtnText}>Purger queue non critique (admin)</Text>
                )}
              </TouchableOpacity>
            )}
            {can('manage_users') && (
              <TouchableOpacity
                style={[s.syncBtn, { marginTop: 8 }]}
                onPress={() =>
                  void exportSyncDiagnostics().catch(e =>
                    Alert.alert('Export diagnostics', e instanceof Error ? e.message : String(e))
                  )
                }
              >
                <Text style={s.syncBtnText}>Exporter diagnostics sync (JSON)</Text>
              </TouchableOpacity>
            )}
            {can('manage_users') && (
              <TouchableOpacity
                style={[s.syncBtn, { marginTop: 8 }]}
                onPress={() =>
                  void copySyncSupportSummary().catch(e =>
                    Alert.alert('Copie résumé', e instanceof Error ? e.message : String(e))
                  )
                }
              >
                <Text style={s.syncBtnText}>Copier résumé support sync</Text>
              </TouchableOpacity>
            )}
            {can('manage_users') && (
              <TouchableOpacity
                style={[s.syncBtn, { marginTop: 8 }]}
                onPress={() =>
                  void copyCompactIncidentSummary().catch(e =>
                    Alert.alert('Copie résumé compact', e instanceof Error ? e.message : String(e))
                  )
                }
              >
                <Text style={s.syncBtnText}>Copier résumé incident compact</Text>
              </TouchableOpacity>
            )}
            {can('manage_users') && (
              <TouchableOpacity
                style={[s.syncBtn, { marginTop: 8 }]}
                onPress={() => {
                  Alert.alert(
                    'Réinitialiser erreurs sync',
                    'Effacer les compteurs d’échecs et la dernière erreur sync ?',
                    [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Réinitialiser',
                        style: 'destructive',
                        onPress: async () => {
                          SyncService.resetSyncFailureCounters();
                          await appendSyncAdminAuditEntry({
                            action: 'force_sync',
                            userId: user?.id,
                            summary: 'Sync failure counters reset by admin',
                          });
                          setSyncAuditEntries(await getSyncAdminAuditEntries());
                          Alert.alert('Sync', 'Compteurs d’échecs réinitialisés.');
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={s.syncBtnText}>Réinitialiser erreurs sync (admin)</Text>
              </TouchableOpacity>
            )}
            {!!syncAuditEntries.length && (
              <View style={{ marginTop: 10 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 4 }}>Audit admin récent</Text>
                {syncAuditEntries.slice(0, 5).map(entry => (
                  <Text key={entry.id} style={{ color: Colors.textSecondary, fontSize: 11, marginBottom: 2 }}>
                    {entry.at} · {entry.action} · {entry.summary ?? '—'}
                  </Text>
                ))}
              </View>
            )}
          </Card>
        )}

        {/* Stats rapides — tap : ouvre l’écran / le filtre correspondant */}
        <View style={s.statsRow}>
          <StatCard
            label="Matériels"
            value={stats.totalMateriels}
            onPress={() =>
              navigation.navigate('Stock', {
                screen: 'StockList',
                params: { applyStatutFilter: 'tous' },
              })
            }
          />
          <StatCard
            label="En prêt"
            value={stats.enPret}
            color={Colors.yellow}
            onPress={() =>
              navigation.navigate('Stock', {
                screen: 'StockList',
                params: { applyStatutFilter: 'en prêt' },
              })
            }
          />
          <StatCard
            label="Prêts actifs"
            value={stats.pretsEnCours}
            color={Colors.blue}
            onPress={() => navigation.navigate('Prêts', { applyFiltreStatut: 'en cours' })}
          />
          <StatCard
            label="Alertes"
            value={stats.alertesConsommables}
            color={Colors.red}
            onPress={() => navigation.navigate('Consom.', { filterLowStock: true })}
          />
        </View>

        {saasFlags['saas.materialProfileEditor'] && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={s.sectionTitle}>Profils dynamiques (fiches matériel)</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
              Définissez ici les modèles de champs (texte, nombre, liste, case à cocher…), puis assignez un modèle à
              chaque matériel dans l’édition de la fiche. La fiche détail affiche toujours les informations classiques et
              vos champs personnalisés — il n’y a plus de réglage « métier » séparé.
            </Text>
            <TouchableOpacity style={s.syncBtn} onPress={() => navigation.navigate('ProfileEditor')}>
              <Text style={s.syncBtnText}>Ouvrir l’éditeur de profils dynamiques</Text>
            </TouchableOpacity>
          </Card>
        )}

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Didacticiel de configuration</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
            Si vous voulez revoir l’assistant de démarrage (pas à pas), vous pouvez le relancer ici.
          </Text>
          <TouchableOpacity
            style={s.syncBtn}
            onPress={async () => {
              await resetWorkspaceOnboardingCompleted();
              navigation.navigate('WorkspaceOnboarding');
            }}
          >
            <Text style={s.syncBtnText}>Relancer le didacticiel</Text>
          </TouchableOpacity>
        </Card>

        {saasFlags['saas.tourMode'] && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={s.sectionTitle}>Tour Mode & Tracking</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
              Gérez les tournées, affectations de matériel, suivi des positions et historique d’activité.
            </Text>
            <TouchableOpacity style={s.syncBtn} onPress={() => navigation.navigate('TourList')}>
              <Text style={s.syncBtnText}>Ouvrir la liste des tournées</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.syncBtn, { marginTop: 8 }]} onPress={() => navigation.navigate('Tracking')}>
              <Text style={s.syncBtnText}>Ouvrir l’écran de suivi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.syncBtn, { marginTop: 8 }]} onPress={() => navigation.navigate('ActivityLog')}>
              <Text style={s.syncBtnText}>Ouvrir le journal d’activité</Text>
            </TouchableOpacity>
          </Card>
        )}

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Notifications & e-mails</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 12 }}>
            Activez ou désactivez les rappels sur cet appareil et l’ouverture des brouillons d’e-mail. Les destinataires
            par défaut sont choisis parmi les adresses enregistrées ci-dessous (liste « Destinataires alertes email »).
            L’envoi automatique du récapitulatif d’alertes nécessite un serveur CATRACK Pro avec SMTP configuré
            (variables SMTP sur le backend).
          </Text>
          <NotifRow
            label="Notifications — prêts (retour)"
            value={notifPrefs.pushPrets}
            onValueChange={v => void persistNotif({ pushPrets: v })}
          />
          <NotifRow
            label="Notifications — VGP & contrôle EPI (échéances)"
            value={notifPrefs.pushVgpControle}
            onValueChange={v => void persistNotif({ pushVgpControle: v })}
          />
          <NotifRow
            label="Notifications — stocks consommables (seuil bas)"
            value={notifPrefs.pushSeuilBas}
            onValueChange={v => void persistNotif({ pushSeuilBas: v })}
          />
          <NotifRow
            label="E-mail — demande de devis (seuil bas)"
            value={notifPrefs.mailSuggestionSeuil}
            onValueChange={v => void persistNotif({ mailSuggestionSeuil: v })}
          />
          <NotifRow
            label="E-mail — rappels liés aux prêts (à venir)"
            value={notifPrefs.mailSuggestionPrets}
            onValueChange={v => void persistNotif({ mailSuggestionPrets: v })}
          />
          <NotifRow
            label="E-mail — rappels VGP / EPI (à venir)"
            value={notifPrefs.mailSuggestionVgp}
            onValueChange={v => void persistNotif({ mailSuggestionVgp: v })}
          />
          <NotifRow
            label="E-mail — envoi auto (Wi‑Fi ou 4G/5G) dès nouvelle alerte"
            value={notifPrefs.mailAutoSendWifiCellular}
            onValueChange={v => void persistNotif({ mailAutoSendWifiCellular: v })}
          />
          <Text style={[s.sectionTitle, { marginTop: 14 }]}>Destinataires par défaut (e-mails)</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 8 }}>
            Cochez les contacts utilisés pour préremplir le champ « À » des e-mails générés (ex. devis). Si aucune case
            n’est cochée, toutes les adresses enregistrées sont proposées.
          </Text>
          {alertes.map(al => (
            <View key={al.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
              <Switch
                value={mailRecipientIds.includes(al.id)}
                onValueChange={v => {
                  setMailRecipientIds(prev => {
                    const next = v ? [...prev, al.id] : prev.filter(id => id !== al.id);
                    void saveMailRecipientAlerteIds(next);
                    return next;
                  });
                }}
                trackColor={{ false: Colors.border, true: Colors.greenMuted }}
                thumbColor={mailRecipientIds.includes(al.id) ? Colors.green : Colors.textMuted}
              />
              <Text style={{ color: Colors.textSecondary, flex: 1, fontSize: 13 }}>{al.email}</Text>
            </View>
          ))}
          <Input
            label="Rappel VGP — jours avant l’échéance (0 = seulement le jour J)"
            value={vgpAdvanceDays}
            onChangeText={setVgpAdvanceDaysState}
            keyboardType="number-pad"
            placeholder="7"
            onBlur={async () => {
              const n = clampVgpAdvanceDays(parseInt(vgpAdvanceDays, 10));
              setVgpAdvanceDaysState(String(n));
              await setVgpNotificationAdvanceDays(n);
              await rescheduleVgpDueReminders(await getMateriel());
            }}
          />
          <TouchableOpacity
            style={s.syncBtn}
            onPress={async () => {
              const ok = await requestNotificationPermission();
              Alert.alert(
                ok ? 'Autorisé' : 'Refusé',
                ok ? 'Les rappels peuvent être planifiés.' : 'Activez les notifications dans les réglages du téléphone.'
              );
              if (ok) {
                await rescheduleVgpDueReminders(await getMateriel());
                await reschedulePretReturnReminders(await getPrets());
                await rescheduleSeuilBasReminders(await getConsommablesAlerte());
              }
            }}
          >
            <Text style={s.syncBtnText}>Demander la permission (notifications)</Text>
          </TouchableOpacity>

          {can('edit_inventory') && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 18 }]}>Test notifications & e-mail</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10, lineHeight: 16 }}>
                Titre et message personnalisables. « Locale » = sur cet appareil (~2 s). « Push » = jetons admin +
                technicien (Expo). « E-mail » = même envoi SMTP que les alertes automatiques (serveur + destinataires
                ci-dessus).
              </Text>
              <Input label="Titre du test" value={testMsgTitle} onChangeText={setTestMsgTitle} />
              <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Message</Text>
              <TextInput
                style={s.testBodyInput}
                value={testMsgBody}
                onChangeText={setTestMsgBody}
                multiline
                placeholder="Votre texte…"
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity
                style={[s.testBtn, testBusy === 'local' && s.testBtnDisabled]}
                disabled={testBusy !== null}
                onPress={async () => {
                  setTestBusy('local');
                  try {
                    const r = await scheduleTestLocalNotification(testMsgTitle, testMsgBody);
                    Alert.alert(r.ok ? 'OK' : 'Erreur', r.message);
                  } catch (e) {
                    Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
                  } finally {
                    setTestBusy(null);
                  }
                }}
              >
                {testBusy === 'local' ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={s.testBtnText}>Test notification locale (~2 s)</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.testBtn, s.testBtnSecondary, testBusy === 'push' && s.testBtnDisabled]}
                disabled={testBusy !== null}
                onPress={async () => {
                  setTestBusy('push');
                  try {
                    const r = await sendTestExpoPushToStaff({ title: testMsgTitle, body: testMsgBody });
                    Alert.alert(r.ok ? 'Push' : 'Push', r.message);
                  } catch (e) {
                    Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
                  } finally {
                    setTestBusy(null);
                  }
                }}
              >
                {testBusy === 'push' ? (
                  <ActivityIndicator color={Colors.green} />
                ) : (
                  <Text style={[s.testBtnText, s.testBtnTextSecondary]}>Test push Expo (admin & technicien)</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.testBtn, s.testBtnOutline, testBusy === 'mail' && s.testBtnDisabled]}
                disabled={testBusy !== null}
                onPress={async () => {
                  setTestBusy('mail');
                  try {
                    const r = await sendTestSmtpAlertEmail({
                      subject: testMsgTitle,
                      text: testMsgBody,
                    });
                    Alert.alert(r.ok ? 'E-mail' : 'E-mail', r.message);
                  } catch (e) {
                    Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
                  } finally {
                    setTestBusy(null);
                  }
                }}
              >
                {testBusy === 'mail' ? (
                  <ActivityIndicator color={Colors.green} />
                ) : (
                  <Text style={[s.testBtnText, s.testBtnTextOutline]}>Test e-mail (SMTP serveur)</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </Card>

        {can('manage_users') && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={s.sectionTitle}>Utilisateurs & rôles</Text>
            <Input label="Nom" value={nuNom} onChangeText={setNuNom} />
            <Input label="PIN" value={nuPin} onChangeText={setNuPin} keyboardType="number-pad" secureTextEntry />
            <SelectPicker label="Rôle" value={nuRole} options={ROLE_OPTIONS} onChange={v => setNuRole(v as AppUserRole)} />
            <TouchableOpacity style={s.addBtnFull} onPress={addAppUser}>
              <Text style={s.addBtnFullText}>+ Créer l’utilisateur</Text>
            </TouchableOpacity>
            {appUsers.map(u => (
              <View key={u.id} style={s.listItem}>
                <Text style={{ color: Colors.white }}>{u.nom}</Text>
                <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{u.role}{u.actif ? '' : ' (inactif)'}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Catégories */}
        {can('edit_inventory') && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, color: Colors.green }}>🏷️</Text>
            <Text style={s.sectionTitle}>Catégories (matériel & consommables)</Text>
          </View>
          <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10 }}>
            Sous-catégories : créez-les depuis Stock ou Consommables lors de l’ajout d’une fiche (parent optionnel).
          </Text>
          <View style={s.addRow}>
            <TextInput
              style={s.addInput}
              placeholder="Nouveau..."
              placeholderTextColor={Colors.textMuted}
              value={newCat}
              onChangeText={setNewCat}
              onSubmitEditing={addCategorie}
              returnKeyType="done"
            />
            <TouchableOpacity style={s.addBtn} onPress={addCategorie}>
              <Text style={{ color: Colors.white, fontSize: 20, fontWeight: 'bold' }}>+</Text>
            </TouchableOpacity>
          </View>
          {[...categories]
            .sort((a, b) =>
              categoryPathById(categories, a.id).localeCompare(categoryPathById(categories, b.id), 'fr', {
                sensitivity: 'base',
              })
            )
            .map(cat => (
            <View key={cat.id} style={s.listItem}>
              <Text style={{ color: Colors.white }}>{categoryPathById(categories, cat.id) || cat.nom}</Text>
              <TouchableOpacity onPress={() => {
                const label = categoryPathById(categories, cat.id) || cat.nom;
                Alert.alert('Supprimer', `Supprimer la catégorie « ${label} » ?`, [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => {
                      deleteCategorie(cat.id)
                        .then(load)
                        .catch(e => Alert.alert('Suppression impossible', e?.message ?? String(e)));
                    },
                  },
                ]);
              }}>
                <Text style={{ color: Colors.red, fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
        )}

        {/* Localisations */}
        {can('edit_inventory') && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, color: Colors.green }}>📍</Text>
            <Text style={s.sectionTitle}>Localisations</Text>
          </View>
          <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10 }}>
            Rattachez chaque localisation fine (réserve, rack…) à un lieu CAPI synchronisé.
          </Text>
          <SelectPicker
            label="Lieu CAPI parent"
            value={newLocLieuId}
            options={[
              { label: '— Choisir un lieu —', value: '' },
              ...lieux.map(l => ({ label: formatLieuPickerLabel(l), value: l.id })),
            ]}
            onChange={setNewLocLieuId}
          />
          <View style={[s.addRow, { marginTop: 8 }]}>
            <TextInput
              style={s.addInput}
              placeholder="Nouvelle localisation..."
              placeholderTextColor={Colors.textMuted}
              value={newLoc}
              onChangeText={setNewLoc}
              onSubmitEditing={addLocalisation}
              returnKeyType="done"
            />
            <TouchableOpacity style={s.addBtn} onPress={addLocalisation}>
              <Text style={{ color: Colors.white, fontSize: 20, fontWeight: 'bold' }}>+</Text>
            </TouchableOpacity>
          </View>
          {localisations.map(loc => {
            const parent = lieux.find(l => l.id === loc.lieu_id);
            return (
            <View key={loc.id} style={s.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.white }}>{loc.nom}</Text>
                {parent ? (
                  <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                    {formatLieuPickerLabel(parent)}
                  </Text>
                ) : loc.lieu_id ? (
                  <Text style={{ color: Colors.yellow, fontSize: 11, marginTop: 2 }}>Lieu parent inconnu</Text>
                ) : (
                  <Text style={{ color: Colors.yellow, fontSize: 11, marginTop: 2 }}>Sans lieu CAPI</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => {
                Alert.alert('Supprimer', `Supprimer "${loc.nom}" ?`, [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => deleteLocalisation(loc.id).then(load) },
                ]);
              }}>
                <Text style={{ color: Colors.red, fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
            );
          })}
        </Card>
        )}

        {/* Répertoire bénéficiaires (prêts) */}
        {can('edit_inventory') && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, color: Colors.green }}>👤</Text>
            <Text style={s.sectionTitle}>Bénéficiaires (répertoire prêts)</Text>
          </View>
          <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10 }}>
            Fiches réutilisables lors de la création d’une feuille de prêt (liste déroulante).
          </Text>
          <Input label="Nom" value={newBenNom} onChangeText={setNewBenNom} placeholder="Nom complet" />
          <Input label="Organisation" value={newBenOrg} onChangeText={setNewBenOrg} placeholder="Optionnel" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input label="Téléphone" value={newBenTel} onChangeText={setNewBenTel} keyboardType="phone-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Email"
                value={newBenEmail}
                onChangeText={setNewBenEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
          <TouchableOpacity style={[s.addBtnFull, { marginTop: 10 }]} onPress={addBeneficiaire}>
            <Text style={s.addBtnFullText}>+ Ajouter au répertoire</Text>
          </TouchableOpacity>
          {beneficiaires.map(b => (
            <View key={b.id} style={s.listItem}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: Colors.white, fontWeight: '600' }}>{b.nom}</Text>
                {b.organisation ? (
                  <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{b.organisation}</Text>
                ) : null}
                <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                  {[b.telephone, b.email].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Supprimer', `Retirer « ${b.nom} » du répertoire ?`, [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Supprimer',
                      style: 'destructive',
                      onPress: () => deleteBeneficiaire(b.id).then(load),
                    },
                  ]);
                }}
              >
                <Text style={{ color: Colors.red, fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
        )}

        {/* Destinataires alertes email */}
        {can('edit_inventory') && (
        <Card style={{ marginBottom: 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, color: Colors.green }}>✉️</Text>
            <Text style={s.sectionTitle}>Destinataires alertes email</Text>
          </View>
          <TextInput
            style={[s.addInput, { marginBottom: 8 }]}
            placeholder="Nom"
            placeholderTextColor={Colors.textMuted}
            value={alertNom}
            onChangeText={setAlertNom}
          />
          <TextInput
            style={[s.addInput, { marginBottom: 8 }]}
            placeholder="Email *"
            placeholderTextColor={Colors.textMuted}
            value={alertEmail}
            onChangeText={setAlertEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={[s.addInput, { marginBottom: 12 }]}
            placeholder="Rôle"
            placeholderTextColor={Colors.textMuted}
            value={alertRole}
            onChangeText={setAlertRole}
          />
          <TouchableOpacity style={s.addBtnFull} onPress={addAlerte}>
            <Text style={s.addBtnFullText}>+ Ajouter</Text>
          </TouchableOpacity>

          {alertes.map(al => (
            <View key={al.id} style={s.listItem}>
              <View>
                <Text style={{ color: Colors.white }}>{al.email}</Text>
                {al.nom && <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{al.nom}</Text>}
              </View>
              <TouchableOpacity onPress={() => deleteAlerteEmail(al.id).then(load)}>
                <Text style={{ color: Colors.red, fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
        )}

        <LegalLinksParamsCard />
      </ScrollView>
    </TabScreenSafeArea>
  );
}

function StatCard({
  label,
  value,
  color = Colors.green,
  onPress,
}: {
  label: string;
  value: number;
  color?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={st.card}
      onPress={onPress}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value}, ouvrir la liste`}
    >
      <Text style={[st.value, { color }]}>{value}</Text>
      <Text style={st.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  value: { fontSize: 22, fontWeight: '800' },
  label: { color: Colors.textMuted, fontSize: 11, marginTop: 2, textAlign: 'center' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  sectionTitle: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  addInput: {
    flex: 1, backgroundColor: Colors.bgInput, borderRadius: 10,
    color: Colors.white, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border, fontSize: 14,
  },
  addBtn: {
    backgroundColor: Colors.green, borderRadius: 10, width: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnFull: {
    backgroundColor: Colors.green, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginBottom: 12,
  },
  addBtnFullText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  listItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  syncBtn: {
    backgroundColor: Colors.green, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  syncBtnText: { color: Colors.white, fontWeight: '600' },
  syncBtnOutline: {
    borderWidth: 1, borderColor: Colors.green, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  syncBtnTextOutline: { color: Colors.green, fontWeight: '600' },
  syncHint: { color: Colors.textMuted, fontSize: 11, marginTop: 10, textAlign: 'center' },
  testBodyInput: {
    minHeight: 80,
    backgroundColor: Colors.bgInput,
    borderRadius: 10,
    color: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  testBtn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginBottom: 8,
  },
  testBtnDisabled: { opacity: 0.55 },
  testBtnText: { color: Colors.white, fontWeight: '600' },
  testBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.green },
  testBtnTextSecondary: { color: Colors.green, fontWeight: '600' },
  testBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  testBtnTextOutline: { color: Colors.textSecondary, fontWeight: '600' },
});
