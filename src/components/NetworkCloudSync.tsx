import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Switch, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Shadow } from '../theme/colors';
import { Card } from './UI';
import { useAppAuth } from '../context/AuthContext';
import { useNetworkStatus } from '../context/NetworkStatusContext';
import { getMateriel, getConsommablesAlerte } from '../db/inventoryDb';
import { rescheduleVgpDueReminders } from '../lib/vgpNotifications';
import { rescheduleSeuilBasReminders } from '../lib/seuilNotifications';
import { isConsumerApp, isV1LanMode } from '../config/appMode';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  getSyncAfterEachActionEnabled,
  setSyncAfterEachActionEnabled,
} from '../lib/syncAfterAction';
import { loadSyncTelemetry, type SyncStamp, type SyncTelemetry } from '../lib/syncTelemetry';
import { getDataBackendMode, type DataBackendMode } from '../lib/backendMode';
import { runInventorySync } from '../lib/inventorySyncOrchestrator';
import { useLanguage } from '../context/LanguageContext';

export function NetworkCloudSync() {
  const { can, refreshSession } = useAppAuth();
  const { isOnline } = useNetworkStatus();
  const { t } = useLanguage();
  const [syncing, setSyncing] = useState(false);
  const [syncAfterEachAction, setSyncAfterEachAction] = useState(false);
  const [backendMode, setBackendMode] = useState<DataBackendMode>('local_server');
  const [telemetry, setTelemetry] = useState<SyncTelemetry>({ api: {}, supabase: {}, accueilpro: {} });

  const refreshTelemetry = useCallback(async () => {
    const [tel, mode] = await Promise.all([loadSyncTelemetry(), getDataBackendMode()]);
    setTelemetry(tel);
    setBackendMode(mode);
  }, []);

  const formatStamp = useCallback((stamp?: SyncStamp) => {
    if (!stamp?.at) return '—';
    const when = new Date(stamp.at);
    const date = Number.isNaN(when.getTime()) ? stamp.at : when.toLocaleString('fr-FR');
    const statusLabel =
      stamp.status === 'ok' ? 'OK' : stamp.status === 'error' ? t('network.accueilpro.statusError') : t('network.accueilpro.statusSkipped');
    return stamp.message ? `${date} · ${statusLabel} · ${stamp.message}` : `${date} · ${statusLabel}`;
  }, [t]);

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
    const result = await runInventorySync({
      scope: `NetworkCloudSync:${direction}`,
      direction,
    });
    setSyncing(false);
    await refreshTelemetry();

    if (result.ok) {
      await refreshSession();
      const [m, seuils] = await Promise.all([getMateriel(), getConsommablesAlerte()]);
      await rescheduleVgpDueReminders(m);
      await rescheduleSeuilBasReminders(seuils);
      const target =
        result.backend === 'supabase'
          ? t('network.backendMode.supabase')
          : t('network.backendMode.local');
      Alert.alert(
        t('network.cloudSync.doneTitle'),
        t('network.cloudSync.doneBody', { target, direction: direction === 'push' ? '↑' : '↓' })
      );
    } else {
      Alert.alert(
        t('network.cloudSync.errorTitle'),
        result.error ?? t('network.cloudSync.errorUnknown')
      );
    }
  };

  if (!can('params_sync')) return null;

  const isLocal = isV1LanMode() || backendMode === 'local_server';
  const syncTitle = isV1LanMode()
    ? t('network.cloudSync.titleLan')
    : isLocal
      ? t('network.cloudSync.titleLocal')
      : t('network.cloudSync.titleSupabase');

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t('network.cloudSync.afterActionTitle')}</Text>
            <Text style={styles.hint}>{t('network.cloudSync.afterActionHint')}</Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 16 }}>{isLocal ? '🖥️' : '☁️'}</Text>
          <Text style={styles.cardTitle}>{syncTitle}</Text>
        </View>
        {syncing ? (
          <ActivityIndicator color={Colors.green} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => void handleSync('push')}>
              <Text style={styles.primaryBtnText}>{t('network.accueilpro.push')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => void handleSync('pull')}>
              <Text style={styles.secondaryBtnText}>{t('network.accueilpro.pull')}</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.syncMetaBox}>
          <Text style={styles.syncMetaTitle}>{t('network.cloudSync.lastSync')}</Text>
          {isLocal ? (
            <>
              <Text style={styles.syncMetaLine}>{t('network.cloudSync.pcPush', { stamp: formatStamp(telemetry.api.push) })}</Text>
              <Text style={styles.syncMetaLine}>{t('network.cloudSync.pcPull', { stamp: formatStamp(telemetry.api.pull) })}</Text>
            </>
          ) : (
            <>
              <Text style={styles.syncMetaLine}>{t('network.cloudSync.sbPush', { stamp: formatStamp(telemetry.supabase.push) })}</Text>
              <Text style={styles.syncMetaLine}>{t('network.cloudSync.sbPull', { stamp: formatStamp(telemetry.supabase.pull) })}</Text>
            </>
          )}
        </View>
        {isConsumerApp() ? (
          <>
            <Text style={[styles.hintMuted, { marginTop: 10 }]}>{t('network.cloudSync.consumerHint1')}</Text>
            <Text style={styles.hintMuted}>{t('network.cloudSync.consumerHint2')}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.hintMuted, { marginTop: 10 }]}>
              {isLocal ? t('network.cloudSync.proHintLocal') : t('network.cloudSync.proHintSupabase')}
            </Text>
            <Text style={styles.hintMuted}>{t('network.cloudSync.proHintForeground')}</Text>
          </>
        )}
        {isSupabaseConfigured() && isLocal && !isConsumerApp() ? (
          <Text style={[styles.hintMuted, { marginTop: 8 }]}>{t('network.cloudSync.photosSupabaseOptional')}</Text>
        ) : null}
        {!isOnline && backendMode === 'supabase' ? (
          <Text style={[styles.hintMuted, { marginTop: 8, color: '#f59e0b' }]}>
            {t('network.cloudSync.offlineSupabase')}
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
