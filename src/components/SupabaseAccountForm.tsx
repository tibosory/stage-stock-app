import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Input } from './UI';
import { useLanguage } from '../context/LanguageContext';
import { useSupabaseAuth } from '../hooks/useAuth';

type Props = {
  compact?: boolean;
};

export function SupabaseAccountForm({ compact }: Props) {
  const { t } = useLanguage();
  const { signInWithEmail, signUpWithEmail } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t('login.supabase.alertTitle'), t('login.supabase.needEmailPassword'));
      return;
    }
    if (register && password.length < 6) {
      Alert.alert(t('login.supabase.alertTitle'), t('login.supabase.passwordMin6'));
      return;
    }
    setBusy(true);
    try {
      const r = register
        ? await signUpWithEmail(email.trim(), password)
        : await signInWithEmail(email.trim(), password);
      if (!r.ok) {
        Alert.alert(t('login.supabase.alertTitle'), r.message ?? t('login.cloud.error'));
        return;
      }
      Alert.alert(
        t('login.supabase.alertTitle'),
        register ? t('login.supabase.createdVerify') : t('login.supabase.connected')
      );
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={compact ? undefined : { marginTop: 4 }}>
      <Input
        label={t('login.placeholder.email')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('login.placeholder.email')}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label={t('login.placeholder.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('login.placeholder.password')}
        secureTextEntry
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.primaryBtn} disabled={busy} onPress={() => void handleSubmit()}>
        {busy ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.primaryBtnText}>
            {register ? t('login.supabase.btnRegister') : t('login.supabase.btnSignIn')}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setRegister(!register)} style={styles.toggleWrap}>
        <Text style={styles.toggleText}>
          {register ? t('login.cloud.toggleToSignIn') : t('login.cloud.toggleToRegister')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  toggleWrap: { marginTop: 12, alignItems: 'center' },
  toggleText: { color: Colors.green, fontWeight: '600', fontSize: 14 },
});
