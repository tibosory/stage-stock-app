import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { FullScreenSafeArea } from '../components/UI';
import { SplashLoadingLogo } from '../components/SplashLoadingLogo';
import { Colors, Shadow } from '../theme/colors';
import { Typography } from '../theme/typography';
import { useAppAuth } from '../context/AuthContext';
import { useSupabaseAuth } from '../hooks/useAuth';
import { listAppUsersForLogin } from '../db/database';
import { isSupabaseConfigured, saveAndApplySupabaseConfig } from '../lib/supabase';
import { AppUserRole } from '../types';

export default function LoginScreen() {
  const { login, loginWithCloud, registerWithCloud, cloudUser } = useAppAuth();
  const {
    user: sbUser,
    signInWithEmail,
    signUpWithEmail,
    signOutSupabase,
  } = useSupabaseAuth();
  const [users, setUsers] = useState<{ id: string; nom: string; role: AppUserRole }[]>([]);
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudName, setCloudName] = useState('');
  const [cloudRegister, setCloudRegister] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [sbEmail, setSbEmail] = useState('');
  const [sbPassword, setSbPassword] = useState('');
  const [sbRegister, setSbRegister] = useState(false);
  const [sbBusy, setSbBusy] = useState(false);
  const [sbSetupUrl, setSbSetupUrl] = useState('');
  const [sbSetupKey, setSbSetupKey] = useState('');
  const [sbSetupBusy, setSbSetupBusy] = useState(false);

  useEffect(() => {
    listAppUsersForLogin().then(u => {
      setUsers(u);
      if (u.length === 1) setUserId(u[0].id);
      setLoading(false);
    });
  }, []);

  const handleSupabase = async () => {
    if (!sbEmail.trim() || !sbPassword) {
      Alert.alert('Supabase', 'Email et mot de passe requis.');
      return;
    }
    if (sbRegister && sbPassword.length < 6) {
      Alert.alert('Supabase', 'Mot de passe : au moins 6 caractères.');
      return;
    }
    setSbBusy(true);
    try {
      const r = sbRegister
        ? await signUpWithEmail(sbEmail.trim(), sbPassword)
        : await signInWithEmail(sbEmail.trim(), sbPassword);
      if (!r.ok) {
        Alert.alert('Supabase', r.message ?? 'Erreur');
        return;
      }
      Alert.alert('Supabase', sbRegister ? 'Compte créé (vérifiez votre email si la confirmation est activée).' : 'Connecté.');
      setSbPassword('');
    } finally {
      setSbBusy(false);
    }
  };

  const handleCloud = async () => {
    if (!cloudEmail.trim() || !cloudPassword) {
      Alert.alert('Compte', 'Renseignez l’email et le mot de passe.');
      return;
    }
    if (cloudRegister && cloudPassword.length < 8) {
      Alert.alert('Compte', 'Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setCloudBusy(true);
    try {
      const r = cloudRegister
        ? await registerWithCloud(cloudEmail.trim(), cloudPassword, cloudName.trim() || undefined)
        : await loginWithCloud(cloudEmail.trim(), cloudPassword);
      if (!r.ok) {
        Alert.alert('Compte', r.message ?? 'Erreur');
        return;
      }
      Alert.alert('Compte', cloudRegister ? 'Compte créé.' : 'Connecté au service.');
      setCloudPassword('');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleLogin = async () => {
    if (!userId || !pin) {
      Alert.alert('Connexion', 'Choisissez un utilisateur et saisissez le code PIN.');
      return;
    }
    setSubmitting(true);
    const ok = await login(userId, pin);
    setSubmitting(false);
    if (!ok) {
      Alert.alert('Connexion', 'PIN incorrect.');
      setPin('');
    }
  };

  if (loading) {
    return (
      <FullScreenSafeArea style={s.center}>
        <SplashLoadingLogo size={120} />
        <ActivityIndicator color={Colors.green} size="small" style={{ marginTop: 20 }} />
      </FullScreenSafeArea>
    );
  }

  return (
    <FullScreenSafeArea style={{ flex: 1, backgroundColor: Colors.bg }}>
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Stage Stock</Text>
      <Text style={s.sub}>Compte en ligne (optionnel) puis accès sur l’appareil avec le PIN</Text>

      {!isSupabaseConfigured() ? (
        <View style={{ marginBottom: 20 }}>
          <Text style={s.section}>Votre projet Supabase</Text>
          <Text style={s.subSmall}>
            Créez un projet sur supabase.com, puis Project Settings → API : URL du projet et clé « anon »
            publique. Vous pourrez modifier ces valeurs dans Paramètres après connexion.
          </Text>
          <TextInput
            style={s.inputEmail}
            value={sbSetupUrl}
            onChangeText={setSbSetupUrl}
            placeholder="https://xxxx.supabase.co"
            placeholderTextColor={Colors.textMuted}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={s.inputEmail}
            value={sbSetupKey}
            onChangeText={setSbSetupKey}
            placeholder="Clé anon (JWT)"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={s.btnSecondary}
            disabled={sbSetupBusy}
            onPress={async () => {
              setSbSetupBusy(true);
              try {
                await saveAndApplySupabaseConfig(sbSetupUrl, sbSetupKey);
                setSbSetupKey('');
                Alert.alert(
                  'Projet enregistré',
                  'Vous pouvez maintenant utiliser la section « Compte Supabase » ci-dessous si besoin.'
                );
              } catch (e: unknown) {
                Alert.alert('Supabase', e instanceof Error ? e.message : String(e));
              } finally {
                setSbSetupBusy(false);
              }
            }}
          >
            {sbSetupBusy ? (
              <ActivityIndicator color={Colors.green} />
            ) : (
              <Text style={s.btnSecondaryTxt}>Enregistrer et utiliser ce projet</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={s.label}>Service Stage Stock</Text>
      {cloudUser ? (
        <Text style={s.cloudOk}>Connecté : {cloudUser.email}</Text>
      ) : (
        <>
          <TextInput
            style={s.inputEmail}
            value={cloudEmail}
            onChangeText={setCloudEmail}
            placeholder="Email"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={s.inputEmail}
            value={cloudPassword}
            onChangeText={setCloudPassword}
            placeholder="Mot de passe"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
          />
          {cloudRegister ? (
            <TextInput
              style={s.inputEmail}
              value={cloudName}
              onChangeText={setCloudName}
              placeholder="Nom affiché (optionnel)"
              placeholderTextColor={Colors.textMuted}
            />
          ) : null}
          <TouchableOpacity
            style={s.btnSecondary}
            onPress={handleCloud}
            disabled={cloudBusy}
          >
            {cloudBusy ? (
              <ActivityIndicator color={Colors.green} />
            ) : (
              <Text style={s.btnSecondaryTxt}>{cloudRegister ? 'Créer le compte' : 'Connexion au service'}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCloudRegister(!cloudRegister)} style={{ marginBottom: 20 }}>
            <Text style={s.link}>{cloudRegister ? 'Déjà un compte ? Se connecter' : 'Créer un compte'}</Text>
          </TouchableOpacity>
        </>
      )}

      {isSupabaseConfigured() ? (
        <>
          <Text style={[s.section, { marginTop: 8 }]}>Compte Supabase (optionnel)</Text>
          <Text style={s.subSmall}>
            Connexion optionnelle au projet Supabase (même email / mot de passe que sur supabase.com si configuré).
          </Text>
          {sbUser ? (
            <>
              <Text style={s.cloudOk}>{sbUser.email ?? '—'}</Text>
              <TouchableOpacity style={s.btnSecondary} onPress={() => void signOutSupabase()}>
                <Text style={s.btnSecondaryTxt}>Déconnexion Supabase</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={s.inputEmail}
                value={sbEmail}
                onChangeText={setSbEmail}
                placeholder="Email Supabase"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={s.inputEmail}
                value={sbPassword}
                onChangeText={setSbPassword}
                placeholder="Mot de passe"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
              />
              <TouchableOpacity style={s.btnSecondary} onPress={handleSupabase} disabled={sbBusy}>
                {sbBusy ? (
                  <ActivityIndicator color={Colors.green} />
                ) : (
                  <Text style={s.btnSecondaryTxt}>{sbRegister ? 'Créer le compte Supabase' : 'Connexion Supabase'}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSbRegister(!sbRegister)} style={{ marginBottom: 16 }}>
                <Text style={s.link}>{sbRegister ? 'Déjà un compte ?' : 'Créer un compte Supabase'}</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      ) : null}

      <Text style={s.section}>Sur cet appareil</Text>
      <Text style={s.subSmall}>PIN à 4 chiffres (admin par défaut : 1234)</Text>

      <Text style={s.label}>Utilisateur</Text>
      <View style={s.chips}>
        {users.map(u => (
          <TouchableOpacity
            key={u.id}
            style={[s.chip, userId === u.id && s.chipOn]}
            onPress={() => setUserId(u.id)}
          >
            <Text style={[s.chipTxt, userId === u.id && s.chipTxtOn]}>
              {u.nom} · {u.role}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Code PIN</Text>
      <TextInput
        style={s.input}
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={12}
        placeholder="••••"
        placeholderTextColor={Colors.textMuted}
      />

      <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.btnTxt}>Se connecter</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
    </FullScreenSafeArea>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, backgroundColor: Colors.bg, padding: 24, paddingTop: 28, paddingBottom: 36 },
  title: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  sub: {
    ...Typography.bodySecondary,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 36,
    paddingHorizontal: 8,
  },
  label: { ...Typography.label, color: Colors.textPrimary, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipOn: { borderColor: 'rgba(52, 211, 153, 0.45)', backgroundColor: Colors.greenBg },
  chipTxt: { color: Colors.textSecondary, fontSize: 13 },
  chipTxtOn: { color: Colors.green },
  input: {
    backgroundColor: Colors.bgInput,
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
    letterSpacing: 4,
  },
  btn: {
    backgroundColor: Colors.green,
    borderRadius: 14,
    paddingVertical: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  btnTxt: { color: Colors.white, fontWeight: '700', fontSize: 17, letterSpacing: 0.2 },
  btnSecondary: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: Colors.greenMuted,
  },
  btnSecondaryTxt: { color: Colors.green, fontWeight: '600', fontSize: 15 },
  inputEmail: {
    backgroundColor: Colors.bgInput,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  cloudOk: { color: Colors.green, fontSize: 14, marginBottom: 16 },
  section: { ...Typography.sectionTitle, marginBottom: 6 },
  subSmall: { color: Colors.textMuted, fontSize: 12, marginBottom: 12 },
  link: { color: Colors.blue, fontSize: 14, textAlign: 'center' },
});
