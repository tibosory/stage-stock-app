import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { Card } from './UI';
import { isV1LanMode } from '../config/appMode';
import { isSupabaseConfigured } from '../lib/supabase';
import { resolveApiUrlForSync } from '../lib/syncGuards';
import {
  getDataBackendMode,
  setDataBackendMode,
  type DataBackendMode,
} from '../lib/backendMode';
import { useLanguage } from '../context/LanguageContext';

export function BackendModePicker() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<DataBackendMode>('local_server');
  const [hasApi, setHasApi] = useState(false);
  const [hasSupabase, setHasSupabase] = useState(false);

  const refresh = useCallback(async () => {
    const [current, apiUrl] = await Promise.all([getDataBackendMode(), resolveApiUrlForSync()]);
    setMode(current);
    setHasApi(Boolean(apiUrl));
    setHasSupabase(isSupabaseConfigured());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  if (isV1LanMode()) return null;

  const onSelect = (next: DataBackendMode) => {
    if (next === mode) return;

    if (next === 'local_server' && !hasApi) {
      Alert.alert(t('network.backendMode.title'), t('network.backendMode.needApiUrl'));
      return;
    }
    if (next === 'supabase' && !hasSupabase) {
      Alert.alert(t('network.backendMode.title'), t('network.backendMode.needSupabase'));
      return;
    }

    Alert.alert(t('network.backendMode.switchTitle'), t('network.backendMode.switchBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('network.backendMode.switchConfirm'),
        onPress: () => {
          void (async () => {
            await setDataBackendMode(next);
            setMode(next);
          })();
        },
      },
    ]);
  };

  return (
    <Card style={{ marginBottom: 14 }}>
      <Text style={styles.cardTitle}>{t('network.backendMode.title')}</Text>
      <Text style={styles.hint}>{t('network.backendMode.hint')}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.chip, mode === 'local_server' && styles.chipActive]}
          onPress={() => onSelect('local_server')}
        >
          <Text style={[styles.chipLabel, mode === 'local_server' && styles.chipLabelActive]}>
            {t('network.backendMode.local')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, mode === 'supabase' && styles.chipActive]}
          onPress={() => onSelect('supabase')}
        >
          <Text style={[styles.chipLabel, mode === 'supabase' && styles.chipLabelActive]}>
            {t('network.backendMode.supabase')}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hintMuted}>
        {mode === 'local_server'
          ? t('network.backendMode.localDetail')
          : t('network.backendMode.supabaseDetail')}
      </Text>
      {!hasApi ? <Text style={styles.warn}>{t('network.backendMode.apiMissing')}</Text> : null}
      {!hasSupabase ? <Text style={styles.warn}>{t('network.backendMode.supabaseMissing')}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: Colors.white, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  hintMuted: { color: Colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 10 },
  warn: { color: '#f59e0b', fontSize: 11, lineHeight: 16, marginTop: 6 },
  row: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
  },
  chipActive: {
    borderColor: Colors.green,
    backgroundColor: Colors.greenMuted,
  },
  chipLabel: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13, textAlign: 'center' },
  chipLabelActive: { color: Colors.green, fontWeight: '800' },
});
