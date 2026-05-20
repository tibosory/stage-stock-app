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
import { listAppUsersForLogin } from '../db/userDb';
import { isSupabaseConfigured, saveAndApplySupabaseConfig } from '../lib/supabase';
import { finalizeAccueilProInvitation, previewAccueilProInvitation } from '../lib/accueilproInvitations';
import { ACCUEILPRO_ORGANISATEUR_ROLE } from '../modules/accueilpro/types/roles';
import { AppUserRole } from '../types';
import { isV1LanMode } from '../config/appMode';
import { useLanguage } from '../context/LanguageContext';

function roleLabelKey(role: AppUserRole): string {
  if (role === 'admin') return 'auth.role.label.admin';
  if (role === 'technicien') return 'auth.role.label.technicien';
  return 'auth.role.label.emprunteur';
}

export default function LoginScreen() {
  const { login, loginWithCloud, registerWithCloud, cloudUser } = useAppAuth();
  const {
    user: sbUser,
    signInWithEmail,
    signUpWithEmail,
    signOutSupabase,
    refreshProfile,
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
  const [apInviteToken, setApInviteToken] = useState('');
  const [apInvitePreview, setApInvitePreview] = useState('');
  const [apInviteBusy, setApInviteBusy] = useState(false);
  const { t } = useLanguage();

  const v1Lan = isV1LanMode();

  useEffect(() => {
    listAppUsersForLogin().then(u => {
      setUsers(u);
      if (u.length === 1) setUserId(u[0].id);
      setLoading(false);
    });
  }, []);

  const handleSupabase = async () => {
    if (!sbEmail.trim() || !sbPassword) {
      Alert.alert(t('login.supabase.alertTitle'), t('login.supabase.needEmailPassword'));
      return;
    }
    if (sbRegister && sbPassword.length < 6) {
      Alert.alert(t('login.supabase.alertTitle'), t('login.supabase.passwordMin6'));
      return;
    }
    setSbBusy(true);
    try {
      const r = sbRegister
        ? await signUpWithEmail(sbEmail.trim(), sbPassword)
        : await signInWithEmail(sbEmail.trim(), sbPassword);
      if (!r.ok) {
        Alert.alert(t('login.supabase.alertTitle'), r.message ?? t('login.cloud.error'));
        return;
      }
      Alert.alert(
        t('login.supabase.alertTitle'),
        sbRegister ? t('login.supabase.createdVerify') : t('login.supabase.connected')
      );
      setSbPassword('');
    } finally {
      setSbBusy(false);
    }
  };

  const handleCloud = async () => {
    if (!cloudEmail.trim() || !cloudPassword) {
      Alert.alert(t('login.cloud.alertTitle'), t('login.cloud.needEmailPassword'));
      return;
    }
    if (cloudRegister && cloudPassword.length < 8) {
      Alert.alert(t('login.cloud.alertTitle'), t('login.cloud.passwordMin8'));
      return;
    }
    setCloudBusy(true);
    try {
      const r = cloudRegister
        ? await registerWithCloud(cloudEmail.trim(), cloudPassword, cloudName.trim() || undefined)
        : await loginWithCloud(cloudEmail.trim(), cloudPassword);
      if (!r.ok) {
        Alert.alert(t('login.cloud.alertTitle'), r.message ?? t('login.cloud.error'));
        return;
      }
      Alert.alert(
        t('login.cloud.alertTitle'),
        cloudRegister ? t('login.cloud.registered') : t('login.cloud.signedIn')
      );
      setCloudPassword('');
    } finally {
      setCloudBusy(false);
    }
  };

  function accueilProInviteErrMessage(code: string, detail?: string): string {
    const k = `login.accueilpro.err.${code}`;
    const msg = t(k);
    if (msg !== k) return detail ? `${msg} ${detail}` : msg;
    const unk = t('login.accueilpro.err.unknown');
    return detail ? `${unk} ${detail}` : unk;
  }

  const handleLogin = async () => {
    if (!userId || !pin) {
      Alert.alert(t('login.alert.pinTitle'), t('login.alert.pickUserPin'));
      return;
    }
    setSubmitting(true);
    const ok = await login(userId, pin);
    setSubmitting(false);
    if (!ok) {
      Alert.alert(t('login.alert.pinTitle'), t('login.alert.badPin'));
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
      <Text style={s.title}>{t('login.title')}</Text>
      <Text style={s.sub}>{v1Lan ? t('login.subtitleV1') : t('login.subtitle')}</Text>

      {!v1Lan && !isSupabaseConfigured() ? (
        <View style={{ marginBottom: 20 }}>
          <Text style={s.section}>{t('login.supabase.section')}</Text>
          <Text style={s.subSmall}>{t('login.supabase.hint')}</Text>
          <TextInput
            style={s.inputEmail}
            value={sbSetupUrl}
            onChangeText={setSbSetupUrl}
            placeholder={t('login.supabase.placeholderUrl')}
            placeholderTextColor={Colors.textMuted}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={s.inputEmail}
            value={sbSetupKey}
            onChangeText={setSbSetupKey}
            placeholder={t('login.supabase.placeholderAnon')}
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
                Alert.alert(t('login.supabase.savedTitle'), t('login.supabase.savedBody'));
              } catch (e: unknown) {
                Alert.alert(t('login.supabase.alertTitle'), e instanceof Error ? e.message : String(e));
              } finally {
                setSbSetupBusy(false);
              }
            }}
          >
            {sbSetupBusy ? (
              <ActivityIndicator color={Colors.green} />
            ) : (
              <Text style={s.btnSecondaryTxt}>{t('login.supabase.saveUse')}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {!v1Lan ? (
        <>
      <Text style={s.label}>{t('login.cloud.serviceLabel')}</Text>
      {cloudUser ? (
        <Text style={s.cloudOk}>{t('login.cloud.connectedLine', { email: cloudUser.email ?? '—' })}</Text>
      ) : (
        <>
          <TextInput
            style={s.inputEmail}
            value={cloudEmail}
            onChangeText={setCloudEmail}
            placeholder={t('login.placeholder.email')}
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={s.inputEmail}
            value={cloudPassword}
            onChangeText={setCloudPassword}
            placeholder={t('login.placeholder.password')}
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
          />
          {cloudRegister ? (
            <TextInput
              style={s.inputEmail}
              value={cloudName}
              onChangeText={setCloudName}
              placeholder={t('login.placeholder.displayName')}
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
              <Text style={s.btnSecondaryTxt}>
                {cloudRegister ? t('login.cloud.btnRegister') : t('login.cloud.btnSignIn')}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCloudRegister(!cloudRegister)} style={{ marginBottom: 20 }}>
            <Text style={s.link}>
              {cloudRegister ? t('login.cloud.toggleToSignIn') : t('login.cloud.toggleToRegister')}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {isSupabaseConfigured() ? (
        <>
          <Text style={[s.section, { marginTop: 8 }]}>{t('profile.supabaseAcctTitle')}</Text>
          <Text style={s.subSmall}>{t('profile.supabaseAcctHint')}</Text>
          {sbUser ? (
            <>
              <Text style={s.cloudOk}>{sbUser.email ?? '—'}</Text>
              <TouchableOpacity style={s.btnSecondary} onPress={() => void signOutSupabase()}>
                <Text style={s.btnSecondaryTxt}>{t('profile.supabaseSignOut')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={s.inputEmail}
                value={sbEmail}
                onChangeText={setSbEmail}
                placeholder={t('login.placeholder.email')}
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={s.inputEmail}
                value={sbPassword}
                onChangeText={setSbPassword}
                placeholder={t('login.placeholder.password')}
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
              />
              <TouchableOpacity style={s.btnSecondary} onPress={handleSupabase} disabled={sbBusy}>
                {sbBusy ? (
                  <ActivityIndicator color={Colors.green} />
                ) : (
                  <Text style={s.btnSecondaryTxt}>
                    {sbRegister ? t('login.supabase.btnRegister') : t('login.supabase.btnSignIn')}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSbRegister(!sbRegister)} style={{ marginBottom: 16 }}>
                <Text style={s.link}>
                  {sbRegister ? t('login.cloud.toggleToSignIn') : t('login.cloud.toggleToRegister')}
                </Text>
              </TouchableOpacity>
            </>
          )}
          <Text style={[s.section, { marginTop: 20 }]}>{t('login.accueilpro.section')}</Text>
          <Text style={s.subSmall}>{t('login.accueilpro.hint')}</Text>
          <TextInput
            style={s.inputEmail}
            value={apInviteToken}
            onChangeText={t => {
              setApInviteToken(t);
              setApInvitePreview('');
            }}
            placeholder={t('login.accueilpro.placeholder')}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={s.btnSecondary}
            disabled={apInviteBusy}
            onPress={async () => {
              setApInviteBusy(true);
              try {
                const r = await previewAccueilProInvitation(apInviteToken);
                if (!r.ok) {
                  Alert.alert(
                    t('login.accueilpro.errorTitle'),
                    accueilProInviteErrMessage(r.error, r.message)
                  );
                  setApInvitePreview('');
                  return;
                }
                const roleLabel =
                  r.invitedRole === ACCUEILPRO_ORGANISATEUR_ROLE
                    ? t('login.accueilpro.role.organisateur')
                    : t('login.accueilpro.role.client');
                setApInvitePreview(t('login.accueilpro.previewLine', { name: r.organizationName, role: roleLabel }));
              } finally {
                setApInviteBusy(false);
              }
            }}
          >
            {apInviteBusy ? (
              <ActivityIndicator color={Colors.green} />
            ) : (
              <Text style={s.btnSecondaryTxt}>{t('login.accueilpro.preview')}</Text>
            )}
          </TouchableOpacity>
          {apInvitePreview ? (
            <Text style={[s.subSmall, { color: Colors.green, marginBottom: 10 }]}>{apInvitePreview}</Text>
          ) : null}
          {sbUser ? (
            <TouchableOpacity
              style={s.btnSecondary}
              disabled={apInviteBusy}
              onPress={async () => {
                setApInviteBusy(true);
                try {
                  const r = await finalizeAccueilProInvitation(apInviteToken);
                  if (!r.ok) {
                    Alert.alert(
                      t('login.accueilpro.errorTitle'),
                      accueilProInviteErrMessage(r.error, r.message)
                    );
                    return;
                  }
                  await refreshProfile();
                  Alert.alert(t('login.supabase.alertTitle'), t('login.accueilpro.done'));
                } finally {
                  setApInviteBusy(false);
                }
              }}
            >
              <Text style={s.btnSecondaryTxt}>{t('login.accueilpro.finalize')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[s.subSmall, { marginBottom: 12 }]}>{t('login.accueilpro.needSignIn')}</Text>
          )}
        </>
      ) : null}
        </>
      ) : null}

      <Text style={s.section}>{t('login.device.section')}</Text>
      <Text style={s.subSmall}>{v1Lan ? t('login.device.pinHintV1') : t('login.device.pinHint')}</Text>

      <Text style={s.label}>{t('login.device.userLabel')}</Text>
      <View style={s.chips}>
        {users.map(u => (
          <TouchableOpacity
            key={u.id}
            style={[s.chip, userId === u.id && s.chipOn]}
            onPress={() => setUserId(u.id)}
          >
            <Text style={[s.chipTxt, userId === u.id && s.chipTxtOn]}>
              {u.nom} · {t(roleLabelKey(u.role))}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>{t('login.device.pinLabel')}</Text>
      <TextInput
        style={s.input}
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={12}
        placeholder={t('login.device.pinPlaceholder')}
        placeholderTextColor={Colors.textMuted}
      />

      <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.btnTxt}>{t('login.device.submit')}</Text>
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
