import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppAuth } from '../context/AuthContext';
import { AccueilProColors } from '../theme/colors';
import { pushAccueilPro, syncAccueilProFromRemote } from '../lib/accueilProSyncOrchestrator';
import { countAccueilProConflicts } from '../lib/accueilProMerge';
import { getDataBackendMode, type DataBackendMode } from '../lib/backendMode';
import { loadSyncTelemetry, recordSyncTelemetry, type SyncStamp, type SyncTelemetry } from '../lib/syncTelemetry';
import { useLanguage } from '../context/LanguageContext';

export function NetworkAccueilProSync() {
  const { can } = useAppAuth();
  const { t } = useLanguage();
  const [syncing, setSyncing] = useState(false);
  const [backendMode, setBackendMode] = useState<DataBackendMode>('local_server');
  const [telemetry, setTelemetry] = useState<SyncTelemetry['accueilpro']>({});

  const refreshTelemetry = useCallback(async () => {
    const [all, mode] = await Promise.all([loadSyncTelemetry(), getDataBackendMode()]);
    setTelemetry(all.accueilpro);
    setBackendMode(mode);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshTelemetry();
    }, [refreshTelemetry])
  );

  const formatStamp = useCallback((stamp?: SyncStamp) => {
    if (!stamp?.at) return '—';
    const when = new Date(stamp.at);
    const date = Number.isNaN(when.getTime()) ? stamp.at : when.toLocaleString('fr-FR');
    const statusLabel =
      stamp.status === 'ok' ? 'OK' : stamp.status === 'error' ? t('network.accueilpro.statusError') : t('network.accueilpro.statusSkipped');
    return stamp.message ? `${date} · ${statusLabel} · ${stamp.message}` : `${date} · ${statusLabel}`;
  }, [t]);

  const handleSync = async (direction: 'push' | 'pull') => {
    setSyncing(true);
    try {
      if (direction === 'push') {
        const pushed = await pushAccueilPro(null);
        await recordSyncTelemetry(
          'accueilpro',
          'push',
          'ok',
          pushed ? t('network.accueilpro.pushed') : t('network.accueilpro.nothingToPush')
        );
        Alert.alert(
          t('network.accueilpro.okTitle'),
          pushed ? t('network.accueilpro.pushOk') : t('network.accueilpro.pushEmpty')
        );
      } else {
        const pull = await syncAccueilProFromRemote(null);
        await recordSyncTelemetry(
          'accueilpro',
          'pull',
          'ok',
          pull.conflicts > 0
            ? t('accueilpro.sync.mergeOk', { applied: String(pull.applied), conflicts: String(pull.conflicts) })
            : t('network.accueilpro.received')
        );
        await countAccueilProConflicts();
        Alert.alert(
          t('network.accueilpro.okTitle'),
          pull.conflicts > 0
            ? t('accueilpro.sync.mergeOk', { applied: String(pull.applied), conflicts: String(pull.conflicts) })
            : t('network.accueilpro.pullOk')
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await recordSyncTelemetry('accueilpro', direction, 'error', msg);
      Alert.alert(t('network.accueilpro.errorTitle'), msg);
    } finally {
      setSyncing(false);
      await refreshTelemetry();
    }
  };

  if (!can('params_sync')) return null;

  const backendHint =
    backendMode === 'supabase'
      ? t('network.accueilpro.routesSupabase')
      : t('network.accueilpro.routes');

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.emoji}>🏛</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{t('network.accueilpro.title')}</Text>
          <Text style={styles.hint}>{t('network.accueilpro.hint')}</Text>
        </View>
      </View>
      {syncing ?
        <ActivityIndicator color={AccueilProColors.gold} />
      : <View style={styles.btnRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleSync('push')}>
            <Text style={styles.primaryBtnText}>{t('network.accueilpro.push')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => void handleSync('pull')}>
            <Text style={styles.secondaryBtnText}>{t('network.accueilpro.pull')}</Text>
          </TouchableOpacity>
        </View>
      }
      <View style={styles.metaBox}>
        <Text style={styles.metaTitle}>{t('network.accueilpro.lastSync')}</Text>
        <Text style={styles.metaLine}>{t('network.accueilpro.lastPush', { stamp: formatStamp(telemetry.push) })}</Text>
        <Text style={styles.metaLine}>{t('network.accueilpro.lastPull', { stamp: formatStamp(telemetry.pull) })}</Text>
      </View>
      <Text style={styles.routesHint}>{backendHint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
    borderRadius: AccueilProColors.radiusLg,
    borderWidth: 1,
    borderColor: 'rgba(200, 151, 58, 0.35)',
    backgroundColor: AccueilProColors.cream,
    padding: 16,
    shadowColor: AccueilProColors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  emoji: { fontSize: 22, marginTop: 2 },
  cardTitle: { color: AccueilProColors.navy, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  hint: { color: AccueilProColors.textMuted, fontSize: 13, lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    flex: 1,
    backgroundColor: AccueilProColors.gold,
    borderRadius: AccueilProColors.radiusMd,
    paddingVertical: 16,
    minHeight: AccueilProColors.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: AccueilProColors.navy, fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: AccueilProColors.gold,
    borderRadius: AccueilProColors.radiusMd,
    paddingVertical: 16,
    minHeight: AccueilProColors.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200, 151, 58, 0.12)',
  },
  secondaryBtnText: { color: AccueilProColors.gold, fontWeight: '700', fontSize: 15 },
  metaBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: AccueilProColors.borderSubtle,
    borderRadius: AccueilProColors.radiusMd,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
    backgroundColor: AccueilProColors.card,
  },
  metaTitle: { color: AccueilProColors.textSecondary, fontSize: 12, fontWeight: '700' },
  metaLine: { color: AccueilProColors.textMuted, fontSize: 12, lineHeight: 17 },
  routesHint: { color: AccueilProColors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 10 },
});
