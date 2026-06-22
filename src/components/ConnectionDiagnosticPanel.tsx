import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Colors } from '../theme/colors';
import { Card } from './UI';
import { runConnectionDiagnostics, type DiagnosticCheck, type DiagnosticLevel } from '../lib/connectionDiagnosticsCore';
import { defaultConnectionDiagnosticsDeps } from '../lib/connectionDiagnostics';
import { toUserFriendlyNetworkMessage, type FriendlyLang } from '../lib/userFriendlyNetworkError';
import { useLanguage } from '../context/LanguageContext';
import { useConnection } from '../context/ConnectionContext';
import { runForegroundInventorySync } from '../lib/foregroundInventorySync';
import { runConnectionRepair } from '../lib/connectionRepair';

function levelEmoji(level: DiagnosticLevel): string {
  if (level === 'ok') return '🟢';
  if (level === 'warn') return '🟠';
  return '🔴';
}

function detailForCheck(
  check: DiagnosticCheck,
  language: FriendlyLang,
  t: (key: string) => string
): string | null {
  if (check.level === 'ok') return null;
  if (check.detail === 'offline') return t('diagnostic.detail.offline');
  if (check.detail === 'no_url') return t('diagnostic.detail.noUrl');
  if (check.detail === 'not_configured') return t('diagnostic.detail.cloudOff');
  if (check.detail === 'no_session') return t('diagnostic.detail.cloudSession');
  if (check.detail === 'no_key') return t('diagnostic.detail.noKey');
  if (check.detail) return toUserFriendlyNetworkMessage(check.detail, language);
  return t('diagnostic.detail.unknown');
}

export function ConnectionDiagnosticPanel() {
  const { language, t } = useLanguage();
  const { refresh } = useConnection();
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<DiagnosticCheck[] | null>(null);
  const [resolvedBase, setResolvedBase] = useState('');

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const repair = await runConnectionRepair();
      setResolvedBase(repair.baseUrl);
      const result = await runConnectionDiagnostics(defaultConnectionDiagnosticsDeps());
      setChecks(result);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  useEffect(() => {
    void run();
  }, [run]);

  const onRepair = useCallback(async () => {
    setBusy(true);
    try {
      const repair = await runConnectionRepair();
      setResolvedBase(repair.baseUrl);
      await refresh();
      if (repair.snapshotOk) {
        await runForegroundInventorySync();
      } else {
        Alert.alert(
          language === 'en' ? 'Repair incomplete' : 'Réparation incomplète',
          language === 'en'
            ? `URL: ${repair.baseUrl || '—'}\n\n${repair.snapshotDetail}\n\nOn the PC: open StageStock Local, check the port in the console (8091, 8092…), then http://127.0.0.1:PORT/health and /api/sync/snapshot. Re-scan the pairing QR if the API key changed.`
            : `URL : ${repair.baseUrl || '—'}\n\n${repair.snapshotDetail}\n\nSur le PC : StageStock Local ouvert, notez le port affiché (8091, 8092…), testez http://127.0.0.1:PORT/health puis /api/sync/snapshot. Refaites le scan QR si la clé API a changé.`,
          [{ text: 'OK' }]
        );
      }
      const result = await runConnectionDiagnostics(defaultConnectionDiagnosticsDeps());
      setChecks(result);
    } finally {
      setBusy(false);
    }
  }, [language, refresh]);

  const labels: Record<string, string> = {
    device_network: t('diagnostic.check.deviceNetwork'),
    local_server: t('diagnostic.check.localServer'),
    local_sync: t('diagnostic.check.localSync'),
    api_auth: t('diagnostic.check.apiAuth'),
    cloud_config: t('diagnostic.check.cloudConfig'),
    cloud_session: t('diagnostic.check.cloudSession'),
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t('diagnostic.title')}</Text>
      <Text style={styles.lead}>{t('diagnostic.lead')}</Text>
      {resolvedBase ? (
        <Text style={styles.urlLine}>
          {language === 'en' ? 'Server URL' : 'URL serveur'} : {resolvedBase}
        </Text>
      ) : null}

      {busy && !checks ? (
        <ActivityIndicator color={Colors.green} style={{ marginVertical: 16 }} />
      ) : (
        (checks ?? []).map(check => {
          const detail = detailForCheck(check, language, t);
          return (
            <View key={check.id} style={styles.row}>
              <Text style={styles.emoji}>{levelEmoji(check.level)}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{labels[check.id] ?? check.id}</Text>
                {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
              </View>
            </View>
          );
        })
      )}

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => void run()} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={Colors.green} />
          ) : (
            <Text style={styles.btnSecondaryText}>{t('diagnostic.refresh')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => void onRepair()} disabled={busy}>
          <Text style={styles.btnPrimaryText}>{t('diagnostic.repair')}</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  title: { color: Colors.white, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  lead: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  urlLine: { color: Colors.green, fontSize: 12, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  emoji: { fontSize: 18, lineHeight: 22 },
  rowBody: { flex: 1 },
  rowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  rowDetail: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: {
    flex: 1,
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  btnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
});
