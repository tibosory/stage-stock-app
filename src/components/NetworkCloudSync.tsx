import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Switch, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Shadow } from '../theme/colors';
import { Card } from './UI';
import { useAppAuth } from '../context/AuthContext';
import { useSyncSettings } from '../context/SyncSettingsContext';
import { useNetworkStatus } from '../context/NetworkStatusContext';
import { syncToInventoryApi, syncFromInventoryApi } from '../lib/inventoryApiSync';
import { getConsommablesAlerte, getMateriel } from '../db/database';
import { rescheduleVgpDueReminders } from '../lib/vgpNotifications';
import { rescheduleSeuilBasReminders } from '../lib/seuilNotifications';
import { isConsumerApp } from '../config/appMode';
import { isSupabaseConfigured, syncFromSupabase, syncToSupabase } from '../lib/supabase';
import {
  getSyncAfterEachActionEnabled,
  setSyncAfterEachActionEnabled,
} from '../lib/syncAfterAction';
import { loadSyncTelemetry, recordSyncTelemetry, type SyncStamp, type SyncTelemetry } from '../lib/syncTelemetry';
import { canCallApiSync } from '../lib/syncGuards';

export function NetworkCloudSync() {
  const { can, refreshSession } = useAppAuth();
  const { doubleBackendEnabled, setDoubleBackendEnabled } = useSyncSettings();
  const { isOnline } = useNetworkStatus();
  const [syncing, setSyncing] = useState(false);
  const [syncAfterEachAction, setSyncAfterEachAction] = useState(false);
  const [telemetry, setTelemetry] = useState<SyncTelemetry>({ api: {}, supabase: {} });

  const refreshTelemetry = useCallback(async () => {
    setTelemetry(await loadSyncTelemetry());
  }, []);

  const formatStamp = useCallback((stamp?: SyncStamp) => {
    if (!stamp?.at) return '—';
    const when = new Date(stamp.at);
    const date = Number.isNaN(when.getTime()) ? stamp.at : when.toLocaleString('fr-FR');
    const statusLabel =
      stamp.status === 'ok' ? 'OK' : stamp.status === 'error' ? 'Échec' : 'Ignoré';
    return stamp.message ? `${date} · ${statusLabel} · ${stamp.message}` : `${date} · ${statusLabel}`;
  }, []);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([getSyncAfterEachActionEnabled()]).then(([autoSync]) => {
        setSyncAfterEachAction(autoSync);
      });
      void refreshTelemetry();
    }, [refreshTelemetry])
  );

  const handleSync = async (direction: 'push' | 'pull') => {
    setSyncing(true);
    const apiGuard = await canCallApiSync(`NetworkCloudSync:${direction}`);
    let apiResult: { ok: boolean; error?: string };
    if (!apiGuard.ok) {
      apiResult = { ok: false, error: apiGuard.reason };
      await recordSyncTelemetry('api', direction, 'skipped', apiGuard.reason);
    } else {
      const fnApi = direction === 'push' ? syncToInventoryApi : syncFromInventoryApi;
      apiResult = await fnApi();
      await recordSyncTelemetry('api', direction, apiResult.ok ? 'ok' : 'error', apiResult.error);
    }
    let supabaseResult: { ok: boolean; error?: string } | null = null;
    if (doubleBackendEnabled && isSupabaseConfigured() && isOnline) {
      const fnSb = direction === 'push' ? syncToSupabase : syncFromSupabase;
      supabaseResult = await fnSb();
      await recordSyncTelemetry(
        'supabase',
        direction,
        supabaseResult.ok ? 'ok' : 'error',
        supabaseResult.error
      );
    } else if (!isOnline) {
      await recordSyncTelemetry('supabase', direction, 'skipped', 'OFFLINE');
    } else if (doubleBackendEnabled && !isSupabaseConfigured()) {
      await recordSyncTelemetry('supabase', direction, 'skipped', 'Supabase non configuré');
    }
    setSyncing(false);
    await refreshTelemetry();
    const syncedOk = apiResult.ok || supabaseResult?.ok;
    if (syncedOk) {
      await refreshSession();
      const [m, seuils] = await Promise.all([getMateriel(), getConsommablesAlerte()]);
      await rescheduleVgpDueReminders(m);
      await rescheduleSeuilBasReminders(seuils);
      const lines = [
        `API inventaire: ${apiResult.ok ? 'OK' : `Échec (${apiResult.error ?? 'inconnu'})`}`,
      ];
      if (doubleBackendEnabled) {
        if (!isOnline) {
          lines.push('Supabase: OFFLINE');
        } else if (isSupabaseConfigured()) {
          lines.push(`Supabase: ${supabaseResult?.ok ? 'OK' : `Échec (${supabaseResult?.error ?? 'inconnu'})`}`);
        } else {
          lines.push('Supabase: non configuré');
        }
      }
      Alert.alert('✓ Sync terminée', lines.join('\n'));
    } else {
      const lines = [
        `API inventaire: ${apiResult.error ?? 'Erreur inconnue'}`,
      ];
      if (doubleBackendEnabled) {
        lines.push(
          !isOnline
            ? 'Supabase: OFFLINE'
            : isSupabaseConfigured()
            ? `Supabase: ${supabaseResult?.error ?? 'Erreur inconnue'}`
            : 'Supabase: non configuré'
        );
      }
      Alert.alert('Erreur sync', lines.join('\n'));
    }
  };

  if (!can('params_sync')) return null;

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Synchro après chaque action</Text>
            <Text style={styles.hint}>
              Après enregistrement (prêt, matériel, consommable, VGP, etc.), envoi puis réception automatiques si le
              serveur répond.
            </Text>
          </View>
          <Switch
            value={syncAfterEachAction}
            onValueChange={async v => {
              await setSyncAfterEachActionEnabled(v);
              setSyncAfterEachAction(v);
            }}
            trackColor={{ false: Colors.border, true: Colors.greenMuted }}
            thumbColor={syncAfterEachAction ? Colors.green : Colors.textMuted}
          />
        </View>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Synchro double backend</Text>
            <Text style={styles.hint}>
              En plus de l’API inventaire, synchronise aussi Supabase (si configuré) pour garder les deux backends à jour.
            </Text>
          </View>
          <Switch
            value={doubleBackendEnabled}
            onValueChange={async v => {
              await setDoubleBackendEnabled(v);
            }}
            trackColor={{ false: Colors.border, true: Colors.greenMuted }}
            thumbColor={doubleBackendEnabled ? Colors.green : Colors.textMuted}
          />
        </View>
        {doubleBackendEnabled && !isSupabaseConfigured() ? (
          <Text style={[styles.hintMuted, { marginTop: 8 }]}>
            Supabase n’est pas configuré sur cet appareil : seule l’API inventaire sera utilisée.
          </Text>
        ) : null}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 16 }}>☁️</Text>
          <Text style={styles.cardTitle}>
            Synchronisation cloud ({doubleBackendEnabled ? 'API + Supabase' : 'API'})
          </Text>
        </View>
        {syncing ? (
          <ActivityIndicator color={Colors.green} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => void handleSync('push')}>
              <Text style={styles.primaryBtnText}>↑ Envoyer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { flex: 1 }]}
              onPress={() => void handleSync('pull')}
            >
              <Text style={styles.secondaryBtnText}>↓ Recevoir</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.syncMetaBox}>
          <Text style={styles.syncMetaTitle}>Dernières synchronisations</Text>
          <Text style={styles.syncMetaLine}>API ↑ {formatStamp(telemetry.api.push)}</Text>
          <Text style={styles.syncMetaLine}>API ↓ {formatStamp(telemetry.api.pull)}</Text>
          {doubleBackendEnabled ? (
            <>
              <Text style={styles.syncMetaLine}>Supabase ↑ {formatStamp(telemetry.supabase.push)}</Text>
              <Text style={styles.syncMetaLine}>Supabase ↓ {formatStamp(telemetry.supabase.pull)}</Text>
            </>
          ) : null}
        </View>
        {isConsumerApp() ? (
          <>
            <Text style={[styles.hintMuted, { marginTop: 10 }]}>
              Envoyez vos modifications vers le service, ou récupérez les données depuis le service.
            </Text>
            <Text style={styles.hintMuted}>
              Une synchro est aussi lancée automatiquement à l’ouverture de l’app si le serveur est joignable.
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.hintMuted, { marginTop: 10 }]}>
              Même URL que ci-dessus (build ou surcharge sur cet appareil). ↑ envoie les lignes locales ; ↓ récupère le
              snapshot serveur. Comptes utilisateurs (PIN) : seul un administrateur les envoie (↑) ; les autres
              téléphones les reçoivent (↓). Les jetons de notification push restent locaux à chaque appareil.
            </Text>
            <Text style={styles.hintMuted}>
              À chaque retour au premier plan, l’app tente aussi envoi puis réception (silencieux en cas d’échec).
            </Text>
          </>
        )}
        {isSupabaseConfigured() && !isConsumerApp() ? (
          <Text style={[styles.hintMuted, { marginTop: 8 }]}>
            Notices PDF / photo : Supabase optionnel pour l’upload (écran Utilisateur).
          </Text>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: Colors.white, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  hintMuted: { color: Colors.textMuted, fontSize: 11, lineHeight: 17 },
  primaryBtn: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadow.card,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.greenMuted,
  },
  secondaryBtnText: { color: Colors.green, fontWeight: '600', fontSize: 15 },
  syncMetaBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 4,
  },
  syncMetaTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  syncMetaLine: { color: Colors.textMuted, fontSize: 11, lineHeight: 16 },
});
