import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { FullScreenSafeArea } from '../../components/UI';
import { Colors, Shadow } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { useAuth } from '../../hooks/useAuth';

type Props = { onNavigateLogin?: () => void; onSignedUp?: () => void };

export default function SupabaseSignupScreen({ onNavigateLogin, onSignedUp }: Props) {
  const { signUpWithEmail, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    const em = email.trim();
    if (!em || !password) {
      Alert.alert('Inscription', 'Email et mot de passe requis.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Inscription', 'Mot de passe : au moins 6 caractères.');
      return;
    }
    setBusy(true);
    try {
      const r = await signUpWithEmail(em, password);
      if (!r.ok) {
        Alert.alert('Inscription', r.message ?? 'Erreur');
        return;
      }
      Alert.alert(
        'Inscription',
        'Si la confirmation email est activée, ouvrez le lien reçu : l’app s’ouvrira sur stagestock://auth/callback.',
        [{ text: 'OK', onPress: () => onSignedUp?.() }]
      );
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <FullScreenSafeArea style={s.center}>
        <ActivityIndicator color={Colors.green} />
      </FullScreenSafeArea>
    );
  }

  return (
    <FullScreenSafeArea style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.flex}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
          <Text style={s.title}>Inscription</Text>
          <Text style={s.sub}>Compte Supabase — redirection : stagestock://auth/callback</Text>

          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe (6+ caractères)"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            textContentType="newPassword"
          />

          <TouchableOpacity style={s.btn} onPress={() => void onSubmit()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={s.btnTxt}>Créer le compte</Text>
            )}
          </TouchableOpacity>

          {onNavigateLogin ? (
            <TouchableOpacity onPress={onNavigateLogin} style={s.linkWrap}>
              <Text style={s.link}>Déjà un compte ? Se connecter</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </FullScreenSafeArea>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: 24 },
  flex: { flex: 1 },
  scroll: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  title: { ...Typography.screenTitle, marginBottom: 8 },
  sub: { ...Typography.bodySecondary, marginBottom: 24 },
  input: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.separator,
  },
  btn: {
    backgroundColor: Colors.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...Shadow.card,
  },
  btnTxt: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  linkWrap: { marginTop: 20, alignItems: 'center' },
  link: { ...Typography.bodySecondary, color: Colors.green },
});
