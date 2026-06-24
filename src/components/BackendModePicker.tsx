import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { Card } from './UI';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAppAuth } from '../context/AuthContext';
import { resolveApiUrlForSync } from '../lib/syncGuards';
import {
  getDataBackendMode,
  setDataBackendMode,
  type DataBackendMode,
} from '../lib/backendMode';
import { useLanguage } from '../context/LanguageContext';

type BackendModePickerProps = {
  onModeChange?: (mode: DataBackendMode) => void;
};

export function BackendModePicker({ onModeChange }: BackendModePickerProps = {}) {
  const { t } = useLanguage();
  const { can } = useAppAuth();
  const [mode, setMode] = useState<DataBackendMode>('local_server');
  const [hasApi, setHasApi] = useState(false);
  const [hasSupabase, setHasSupabase] = useState(false);

  const refresh = useCallback(async () => {
    const [current, apiUrl] = await Promise.all([getDataBackendMode(), resolveApiUrlForSync()]);
    setMode(current);
    onModeChange?.(current);
    setHasApi(Boolean(apiUrl));
    setHasSupabase(isSupabaseConfigured());
  }, [onModeChange]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  if (!can('params_sync')) return null;

  const onSelect = (next: DataBackendMode) => {
    if (next === mode) return;

    Alert.alert(t('network.backendMode.switchTitle'), t('network.backendMode.switchBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('network.backendMode.switchConfirm'),
        onPress: () => {
          void (async () => {
            await setDataBackendMode(next);
            setMode(next);
            onModeChange?.(next);
          })();
        },
      },
    ]);
  };

  return (
    <Card style={{ marginBottom: 14 }}>
      <Text style={styles.cardTitle}>{t('network.backendMode.submenuTitle')}</Text>
      <Text style={styles.hint}>{t('network.backendMode.hint')}</Text>
      <View style={styles.submenuRow}>
        <TouchableOpacity
          style={[styles.submenuBtn, mode === 'local_server' && styles.submenuBtnActive]}
          onPress={() => onSelect('local_server')}
        >
          <Text style={styles.submenuEmoji}>🖥️</Text>
          <Text style={[styles.submenuLabel, mode === 'local_server' && styles.submenuLabelActive]}>
            {t('network.backendMode.workLocal')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submenuBtn, mode === 'supabase' && styles.submenuBtnActive]}
          onPress={() => onSelect('supabase')}
        >
          <Text style={styles.submenuEmoji}>☁️</Text>
          <Text style={[styles.submenuLabel, mode === 'supabase' && styles.submenuLabelActive]}>
            {t('network.backendMode.workSupabase')}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hintMuted}>
        {mode === 'local_server'
          ? t('network.backendMode.localDetail')
          : t('network.backendMode.supabaseDetail')}
      </Text>
      {!hasApi && mode === 'local_server' ? (
        <Text style={styles.warn}>{t('network.backendMode.apiMissing')}</Text>
      ) : null}
      {!hasSupabase && mode === 'supabase' ? (
        <Text style={styles.warn}>{t('network.backendMode.supabaseMissing')}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: Colors.white, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  hintMuted: { color: Colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 10 },
  warn: { color: '#f59e0b', fontSize: 11, lineHeight: 16, marginTop: 6 },
  submenuRow: { flexDirection: 'column', gap: 10 },
  submenuBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
  },
  submenuBtnActive: {
    borderColor: Colors.green,
    backgroundColor: Colors.greenMuted,
  },
  submenuEmoji: { fontSize: 22 },
  submenuLabel: { flex: 1, color: Colors.textSecondary, fontWeight: '600', fontSize: 14, lineHeight: 20 },
  submenuLabelActive: { color: Colors.green, fontWeight: '800' },
});
