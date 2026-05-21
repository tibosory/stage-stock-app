import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { Card, Input } from './UI';
import { useLanguage } from '../context/LanguageContext';
import { useSupabaseAuth } from '../hooks/useAuth';
import {
  clearStoredSupabaseOverrideAndReapply,
  getEffectiveSupabaseUrlForDisplay,
  getSupabaseProjectUrlFromBuild,
  hasSupabaseUserOverride,
  isSupabaseConfigured,
  saveAndApplySupabaseConfig,
} from '../lib/supabase';
import { exportShareSupabaseSchemaSql } from '../lib/supabaseSchemaSql';

export function NetworkSupabasePanel() {
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const { user: sbUser, refreshProfile, signOutSupabase } = useSupabaseAuth();
  const [sbUrlEdit, setSbUrlEdit] = useState('');
  const [sbKeyEdit, setSbKeyEdit] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setSbUrlEdit(getEffectiveSupabaseUrlForDisplay());
    setSbKeyEdit('');
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      void refreshProfile();
    }, [refresh, refreshProfile])
  );

  const configured = isSupabaseConfigured();

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <Text style={styles.cardTitle}>{t('network.supabasePanel.statusTitle')}</Text>
        <Text style={styles.hint}>{t('network.supabasePanel.statusHint')}</Text>
        <Text style={styles.mono}>
          {configured ? getEffectiveSupabaseUrlForDisplay() : t('profile.notConfigured')}
        </Text>
        {getSupabaseProjectUrlFromBuild() ? (
          <Text style={styles.hintMuted}>
            {t('profile.buildValue', { url: getSupabaseProjectUrlFromBuild() })}
          </Text>
        ) : (
          <Text style={styles.hintMuted}>{t('profile.noSupabaseBuild')}</Text>
        )}
        <Text style={[styles.cardTitle, { marginTop: 14 }]}>{t('network.supabasePanel.accountTitle')}</Text>
        <Text style={styles.mono}>
          {sbUser?.email ?? t('network.supabasePanel.notSignedIn')}
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.getParent()?.navigate('Login')}
        >
          <Text style={styles.primaryBtnText}>
            {sbUser ? t('network.supabasePanel.manageAccount') : t('network.supabasePanel.signIn')}
          </Text>
        </TouchableOpacity>
        {sbUser ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => void signOutSupabase()}>
            <Text style={styles.secondaryBtnText}>{t('profile.signOutCloud')}</Text>
          </TouchableOpacity>
        ) : null}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Text style={styles.cardTitle}>{t('profile.supabaseDeviceTitle')}</Text>
        <Text style={styles.hint}>{t('network.supabasePanel.projectHint')}</Text>
        <Input
          label={t('profile.projectUrl')}
          value={sbUrlEdit}
          onChangeText={setSbUrlEdit}
          placeholder={t('login.supabase.placeholderUrl')}
          autoCapitalize="none"
        />
        <Input
          label={t('profile.anonKey')}
          value={sbKeyEdit}
          onChangeText={setSbKeyEdit}
          placeholder={hasSupabaseUserOverride() ? t('profile.anonPlaceholderNew') : t('profile.anonPlaceholder')}
          secureTextEntry
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={styles.primaryBtn}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await saveAndApplySupabaseConfig(sbUrlEdit, sbKeyEdit);
              setSbKeyEdit('');
              setSbUrlEdit(getEffectiveSupabaseUrlForDisplay());
              void refreshProfile();
              Alert.alert(t('common.success'), t('profile.supabaseSaved'));
            } catch (e: unknown) {
              Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>{t('profile.saveUrlKey')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          disabled={busy}
          onPress={async () => {
            try {
              await exportShareSupabaseSchemaSql();
              Alert.alert(t('common.success'), t('profile.supabaseSchemaExported'));
            } catch (e: unknown) {
              Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
            }
          }}
        >
          <Text style={styles.secondaryBtnText}>{t('profile.downloadSupabaseSchema')}</Text>
        </TouchableOpacity>
        {hasSupabaseUserOverride() ? (
          <TouchableOpacity
            style={styles.dangerOutline}
            disabled={busy}
            onPress={() => {
              Alert.alert(t('profile.resetBuildTitle'), t('profile.resetBuildBody'), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('profile.resetBuildConfirm'),
                  style: 'destructive',
                  onPress: async () => {
                    setBusy(true);
                    try {
                      await clearStoredSupabaseOverrideAndReapply();
                      setSbUrlEdit(getEffectiveSupabaseUrlForDisplay());
                      setSbKeyEdit('');
                      void refreshProfile();
                      Alert.alert(t('common.success'), t('profile.resetDone'));
                    } catch (e: unknown) {
                      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
                    } finally {
                      setBusy(false);
                    }
                  },
                },
              ]);
            }}
          >
            <Text style={styles.dangerOutlineText}>{t('profile.resetBuildConfirm')}</Text>
          </TouchableOpacity>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: Colors.white, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  hintMuted: { color: Colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 6 },
  mono: { color: Colors.textSecondary, fontSize: 13, marginBottom: 10 },
  primaryBtn: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
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
  dangerOutline: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  dangerOutlineText: { color: Colors.red, fontWeight: '600', fontSize: 14 },
});
