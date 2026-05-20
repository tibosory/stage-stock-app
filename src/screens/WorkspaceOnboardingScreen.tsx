// Assistant de premier lancement — jumelage serveur PC obligatoire avant usage.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { Card, Input, TabScreenSafeArea } from '../components/UI';
import { useAppAuth } from '../context/AuthContext';
import { setWorkspaceOnboardingCompleted, setServerPairingVerified, hasVerifiedServerPairing, hasCompletedWorkspaceOnboarding } from '../lib/workspaceOnboardingStorage';
import { loadTheatreBranding, saveTheatreIdentity } from '../lib/theatreBranding';
import { loadUserProfile, saveUserProfile, type UserProfile } from '../lib/userProfileStorage';
import {
  getApiBaseOverride,
  getApiKeyOverride,
  looksLikeHttpUrl,
  setApiBaseOverride,
  setApiKeyOverride,
} from '../lib/apiEndpointStorage';
import { getBundledDefaultApiBase, getResolvedApiBase, pingStageStockApi } from '../config/stageStockApi';
import { getWindowsServerInstallerUrl } from '../config/installerUrls';
import { useConnection } from '../context/ConnectionContext';
import { isConsumerApp } from '../config/appMode';
import { WindowsInstallerCard } from '../components/WindowsInstallerCard';
import { requestNotificationPermission, reschedulePretReturnReminders } from '../lib/pretNotifications';
import { rescheduleVgpDueReminders } from '../lib/vgpNotifications';
import { rescheduleSeuilBasReminders } from '../lib/seuilNotifications';
import { getPrets } from '../db/loanDb';
import { getMateriel, getConsommablesAlerte } from '../db/inventoryDb';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGE_OPTIONS, type AppLanguage } from '../i18n/strings';

type Step = 'language' | 'welcome' | 'place' | 'server' | 'profile' | 'done';

function useSteps(isEmp: boolean): Step[] {
  return useMemo(
    () =>
      (isEmp
        ? (['language', 'welcome', 'server', 'done'] as const)
        : (['language', 'welcome', 'place', 'server', 'profile', 'done'] as const)),
    [isEmp]
  );
}

export default function WorkspaceOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAppAuth();
  const { language, setLanguage, t } = useLanguage();
  const { refresh: refreshConnection } = useConnection();
  const isEmp = user?.role === 'emprunteur';
  const steps = useSteps(isEmp);

  const [ix, setIx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [theatreName, setTheatreName] = useState('');
  const [theatreAddress, setTheatreAddress] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [bundled, setBundled] = useState('');
  const [resolved, setResolved] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  /** true = dernier test ping API réussi (étape serveur) */
  const [serverVerified, setServerVerified] = useState(false);
  const [serverVerifyBusy, setServerVerifyBusy] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(language);

  const step = steps[ix] ?? 'done';
  const stepNum = ix + 1;
  const totalSteps = steps.length;

  const goApp = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'ActivityHome' as never }],
      })
    );
  }, [navigation]);

  const markServerVerified = useCallback(async () => {
    setServerVerified(true);
    await setServerPairingVerified();
    await refreshConnection();
  }, [refreshConnection]);

  const requireServerVerified = useCallback(async (): Promise<boolean> => {
    if (serverVerified) return true;
    const ping = await pingStageStockApi();
    if (ping.ok) {
      await markServerVerified();
      return true;
    }
    Alert.alert(t('onboarding.serverRequiredTitle'), t('onboarding.serverRequiredBody'), [{ text: t('common.ok') }]);
    return false;
  }, [markServerVerified, serverVerified, t]);

  useEffect(() => {
    void (async () => {
      const b = getBundledDefaultApiBase();
      const [r, p, base, key, brand] = await Promise.all([
        getResolvedApiBase(),
        loadUserProfile(),
        getApiBaseOverride(),
        getApiKeyOverride(),
        loadTheatreBranding(),
      ]);
      setBundled(b);
      setResolved(r);
      setProfile(p);
      setTheatreName(brand.theatreName);
      setTheatreAddress(brand.theatreAddress);
      setBaseUrl(base ?? '');
      setApiKey(key ?? '');

      if (r) {
        const ping = await pingStageStockApi();
        if (ping.ok) {
          setServerVerified(true);
          await setServerPairingVerified();
        }
      }
    })();
  }, []);

  useEffect(() => {
    setServerVerified(false);
  }, [baseUrl, apiKey]);

  useEffect(() => {
    void (async () => {
      const [paired, done] = await Promise.all([
        hasVerifiedServerPairing(),
        hasCompletedWorkspaceOnboarding(),
      ]);
      if (!paired && done) {
        const serverIx = steps.indexOf('server');
        if (serverIx >= 0) setIx(serverIx);
      }
    })();
  }, [steps]);

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  const openInstallerInBrowser = useCallback(async () => {
    const u = getWindowsServerInstallerUrl().trim();
    if (!u) {
      Alert.alert(t('onboarding.noInstallerLinkTitle'), t('onboarding.noInstallerLinkBody'), [{ text: t('common.ok') }]);
      return;
    }
    if (await Linking.canOpenURL(u)) {
      await Linking.openURL(u);
    } else {
      Alert.alert(t('onboarding.downloadLinkTitle'), u, [{ text: t('common.ok') }]);
    }
  }, [t]);

  const advanceFromServer = useCallback(async () => {
    const urlTrim = baseUrl.trim();
    if (urlTrim && !looksLikeHttpUrl(urlTrim)) {
      Alert.alert(t('network.invalidUrlTitle'), t('onboarding.invalidUrlBody'));
      return;
    }
    setSaving(true);
    try {
      await setApiBaseOverride(urlTrim || null);
      await setApiKeyOverride(apiKey.trim() || null);
      const r = await getResolvedApiBase();
      setResolved(r);
      setIx(i => i + 1);
    } finally {
      setSaving(false);
    }
  }, [apiKey, baseUrl, t]);

  const handleVerifyServer = useCallback(async () => {
    const urlTrim = baseUrl.trim();
    if (urlTrim && !looksLikeHttpUrl(urlTrim)) {
      Alert.alert(t('network.invalidUrlTitle'), t('onboarding.invalidUrlExpectedBody'), [{ text: t('common.ok') }]);
      return;
    }
    setServerVerifyBusy(true);
    try {
      await setApiBaseOverride(urlTrim || null);
      await setApiKeyOverride(apiKey.trim() || null);
      const r = await getResolvedApiBase();
      setResolved(r);
      const ping = await pingStageStockApi();
      if (ping.ok) {
        await markServerVerified();
        Alert.alert(t('network.testOk'), t('onboarding.connectionOkBody'));
      } else {
        setServerVerified(false);
        Alert.alert(t('onboarding.connectionFailedTitle'), ping.message, [{ text: t('common.ok') }]);
      }
    } catch (e) {
      setServerVerified(false);
      Alert.alert(t('scanner.error'), e instanceof Error ? e.message : String(e));
    } finally {
      setServerVerifyBusy(false);
    }
  }, [apiKey, baseUrl, markServerVerified, t]);

  const onNext = useCallback(async () => {
    if (step === 'language') {
      setSaving(true);
      try {
        await setLanguage(selectedLanguage);
        setIx(i => Math.min(i + 1, steps.length - 1));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (step === 'welcome') {
      setIx(i => Math.min(i + 1, steps.length - 1));
      return;
    }
    if (step === 'place') {
      setSaving(true);
      try {
        await saveTheatreIdentity(theatreName.trim(), theatreAddress.trim());
        setIx(i => i + 1);
      } finally {
        setSaving(false);
      }
      return;
    }
    if (step === 'server') {
      const urlTrim = baseUrl.trim();
      if (urlTrim && !looksLikeHttpUrl(urlTrim)) {
        Alert.alert(t('network.invalidUrlTitle'), t('onboarding.invalidUrlBody'));
        return;
      }
      if (!(await requireServerVerified())) return;
      await advanceFromServer();
      return;
    }
    if (step === 'profile' && profile) {
      setSaving(true);
      try {
        await saveUserProfile(profile);
        setIx(i => i + 1);
      } finally {
        setSaving(false);
      }
      return;
    }
    if (step === 'done') {
      if (!(await requireServerVerified())) return;
      setSaving(true);
      try {
        const ok = await requestNotificationPermission();
        if (ok) {
          const [prets, mats, seuils] = await Promise.all([
            getPrets(),
            getMateriel(),
            getConsommablesAlerte(),
          ]);
          await reschedulePretReturnReminders(prets);
          await rescheduleVgpDueReminders(mats);
          await rescheduleSeuilBasReminders(seuils);
        }
        await setWorkspaceOnboardingCompleted();
        goApp();
      } finally {
        setSaving(false);
      }
    }
  }, [advanceFromServer, apiKey, baseUrl, goApp, profile, requireServerVerified, selectedLanguage, setLanguage, step, steps.length, t, theatreAddress, theatreName]);

  const onSkipStep = useCallback(() => {
    if (step === 'server') return;
    if (ix >= steps.length - 1) return;
    setIx(i => i + 1);
  }, [ix, step, steps.length]);

  const primaryDisabled =
    saving || serverVerifyBusy || (step === 'server' && !serverVerified) || (step === 'done' && !serverVerified);

  if (!profile) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={Colors.green} />
        <Text style={styles.bootText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <TabScreenSafeArea style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.progress}>
          {t('onboarding.progressWord')} {stepNum} / {totalSteps}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 'welcome' && (
          <>
            <Text style={styles.title} accessibilityRole="header">
              {t('onboarding.welcomeTitle')}
            </Text>
            <Text style={styles.lead}>{t('onboarding.welcomeLead')}</Text>
            <Text style={styles.muted}>{t('onboarding.welcomeMutedOffline')}</Text>
            <Text style={styles.muted}>{t('onboarding.welcomeMutedInstall')}</Text>
          </>
        )}

        {step === 'language' && (
          <>
            <Text style={styles.title} accessibilityRole="header">
              {t('onboarding.languageTitle')}
            </Text>
            <Text style={styles.lead}>{t('onboarding.languageLead')}</Text>
            <Card style={{ marginTop: 12 }}>
              {LANGUAGE_OPTIONS.map(opt => {
                const active = selectedLanguage === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.languageRow,
                      active && styles.languageRowActive,
                    ]}
                    onPress={() => setSelectedLanguage(opt.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('onboarding.a11y.chooseLanguagePrefix')}${opt.label}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.languageLabel, active && styles.languageLabelActive]}>{opt.label}</Text>
                    {active ? <Text style={styles.languageTick}>✓</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </Card>
          </>
        )}

        {step === 'place' && (
          <>
            <Text style={styles.title}>{t('onboarding.placeTitle')}</Text>
            <Text style={styles.lead}>{t('onboarding.placeLead')}</Text>
            <Card style={{ marginTop: 12 }}>
              <Input label={t('onboarding.placeName')} value={theatreName} onChangeText={setTheatreName} placeholder={t('onboarding.placeNamePlaceholder')} />
              <Text style={styles.inputLabel}>{t('onboarding.placeAddressLabel')}</Text>
              <TextInput
                style={styles.area}
                value={theatreAddress}
                onChangeText={setTheatreAddress}
                placeholder={t('onboarding.placeAddressPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlignVertical="top"
              />
            </Card>
          </>
        )}

        {step === 'server' && (
          <>
            <Text style={styles.title}>{t('onboarding.serverTitle')}</Text>
            <Text style={styles.lead}>{t('onboarding.serverLead')}</Text>

            {Platform.OS === 'android' && (
              <View style={styles.installerBlock}>
                <Text style={styles.recipeTitle}>{t('onboarding.downloadAndroid')}</Text>
                <Text style={styles.mutedBottom}>{t('onboarding.androidShareHint')}</Text>
                <WindowsInstallerCard />
              </View>
            )}

            {Platform.OS !== 'android' && (
              <Card style={styles.recipeCard}>
                <Text style={styles.recipeTitle}>{t('onboarding.downloadOther')}</Text>
                <Text style={styles.recipeStep}>{t('onboarding.downloadOtherIntro')}</Text>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => void openInstallerInBrowser()}>
                  <Text style={styles.outlineBtnText}>{t('onboarding.openInstallerLink')}</Text>
                </TouchableOpacity>
              </Card>
            )}

            <Card style={styles.recipeCard}>
              <Text style={styles.recipeTitle}>{t('onboarding.pcStepsTitle')}</Text>
              <View style={styles.stepLine}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>1</Text>
                </View>
                <Text style={styles.stepText}>{t('onboarding.pcStep1')}</Text>
              </View>
              <View style={styles.stepLine}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
                <Text style={styles.stepText}>{t('onboarding.pcStep2')}</Text>
              </View>
              <View style={styles.stepLine}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <Text style={styles.stepText}>{t('onboarding.pcStep3')}</Text>
              </View>
            </Card>

            <Card style={styles.recipeCard}>
              <Text style={styles.recipeTitle}>{t('onboarding.pairingTitle')}</Text>
              <View style={styles.stepLine}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>4</Text>
                </View>
                <Text style={styles.stepText}>{t('onboarding.pairingStep4')}</Text>
              </View>
              <View style={styles.stepLine}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>5</Text>
                </View>
                <Text style={styles.stepText}>{t('onboarding.pairingStep5')}</Text>
              </View>
              <View style={styles.stepLine}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>6</Text>
                </View>
                <Text style={styles.stepText}>{t('onboarding.pairingStep6')}</Text>
              </View>
            </Card>

            {!!bundled && (
              <Text style={styles.hintBox}>
                {t('onboarding.hintBuildUrlPrefix')}
                {bundled || '—'}
              </Text>
            )}
            {!!resolved && (
              <Text style={styles.hintBox}>
                {t('onboarding.hintEffectiveUrlPrefix')}
                {resolved}
              </Text>
            )}

            <Card style={{ marginTop: 8 }}>
              <Text style={styles.subCardTitle}>{t('onboarding.apiAccessTitle')}</Text>
              <Text style={styles.mutedBottom}>{t('onboarding.apiAccessLead')}</Text>
              <Input
                label={t('onboarding.apiBaseLabel')}
                value={baseUrl}
                onChangeText={setBaseUrl}
                autoCapitalize="none"
                placeholder={t('onboarding.apiBasePlaceholder')}
                keyboardType="url"
              />
              <Input
                label={t('network.field.apiKeyOptional')}
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                placeholder={t('onboarding.apiKeyPlaceholder')}
              />
              {serverVerified ? (
                <View style={styles.verifiedRow}>
                  <Text style={styles.verifiedText}>{t('onboarding.lastVerifyOk')}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.verifyBtn, (serverVerifyBusy || saving) && { opacity: 0.6 }]}
                onPress={() => void handleVerifyServer()}
                disabled={serverVerifyBusy || saving}
                accessibilityLabel={t('onboarding.verifyServerA11y')}
              >
                {serverVerifyBusy ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.verifyBtnText}>{t('onboarding.verifyServer')}</Text>
                )}
              </TouchableOpacity>
            </Card>
          </>
        )}

        {step === 'profile' && (
          <>
            <Text style={styles.title}>{t('onboarding.profileTitle')}</Text>
            <Text style={styles.lead}>{t('onboarding.profileLead')}</Text>
            <Card style={{ marginTop: 12 }}>
              <View style={styles.row2}>
                <View style={styles.half}>
                  <Input
                    label={t('onboarding.firstName')}
                    value={profile.prenom}
                    onChangeText={t => setProfile(p => (p ? { ...p, prenom: t } : p))}
                  />
                </View>
                <View style={styles.half}>
                  <Input
                    label={t('onboarding.lastName')}
                    value={profile.nom}
                    onChangeText={t => setProfile(p => (p ? { ...p, nom: t } : p))}
                  />
                </View>
              </View>
              <Input
                label={t('onboarding.function')}
                value={profile.fonction}
                onChangeText={t => setProfile(p => (p ? { ...p, fonction: t } : p))}
              />
              <Input
                label={t('onboarding.organization')}
                value={profile.etablissement}
                onChangeText={t => setProfile(p => (p ? { ...p, etablissement: t } : p))}
              />
              <Input
                label={t('onboarding.phone')}
                value={profile.telephone}
                onChangeText={t => setProfile(p => (p ? { ...p, telephone: t } : p))}
                keyboardType="phone-pad"
              />
              <Input
                label={t('onboarding.email')}
                value={profile.email}
                onChangeText={t => setProfile(p => (p ? { ...p, email: t } : p))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Card>
          </>
        )}

        {step === 'done' && (
          <>
            <Text style={styles.title}>{t('onboarding.almostReady')}</Text>
            <Text style={styles.lead}>{t('onboarding.doneLeadReminders')}</Text>
            <Card style={{ marginTop: 8 }}>
              <Text style={styles.muted}>{t('onboarding.doneCheckSettings')}</Text>
            </Card>
            {serverVerified && (
              <View style={styles.verifiedRow}>
                <Text style={styles.verifiedText}>
                  {isConsumerApp() ? t('onboarding.doneVerifiedConsumer') : t('onboarding.doneVerifiedPro')}
                </Text>
              </View>
            )}
            {!serverVerified && !!baseUrl.trim() && (
              <Card style={styles.tipNote}>
                <Text style={styles.muted}>{t('onboarding.doneUnverifiedUrlHint')}</Text>
              </Card>
            )}
            <Card style={{ marginTop: 12 }}>
              <Text style={styles.muted}>{t('onboarding.doneNotificationsHint')}</Text>
            </Card>
          </>
        )}

        <View style={styles.btnRow}>
          {step !== 'welcome' && step !== 'done' && step !== 'server' && (
            <TouchableOpacity
              style={[styles.btnSecondary, saving && { opacity: 0.5 }]}
              onPress={onSkipStep}
              disabled={saving}
            >
              <Text style={styles.btnSecondaryText}>{t('onboarding.skipStep')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.btnPrimary, primaryDisabled && { opacity: 0.5 }]}
            onPress={() => void onNext()}
            disabled={primaryDisabled}
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {step === 'welcome'
                  ? t('onboarding.start')
                  : step === 'done'
                    ? t('onboarding.finish')
                    : t('onboarding.next')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  boot: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  bootText: { ...Typography.caption, marginTop: Spacing.md, color: Colors.textMuted },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  progress: { ...Typography.caption, color: Colors.textMuted, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  title: { ...Typography.screenTitle, fontSize: 24, marginBottom: Spacing.sm },
  lead: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.md },
  muted: { ...Typography.caption, color: Colors.textMuted, lineHeight: 18, marginTop: 4 },
  inputLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 6, marginTop: 4, fontWeight: '600' },
  area: {
    backgroundColor: Colors.bgInput,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.white,
    minHeight: 100,
    padding: 12,
    fontSize: 15,
  },
  hintBox: { ...Typography.caption, color: Colors.textMuted, marginBottom: 6 },
  recipeCard: {
    marginBottom: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  recipeTitle: { color: Colors.green, fontSize: 14, fontWeight: '800', marginBottom: 8 },
  subCardTitle: { color: Colors.textSecondary, fontSize: 14, fontWeight: '800', marginBottom: 8 },
  recipeStep: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  installerBlock: { marginBottom: 12, marginTop: 4 },
  stepLine: { flexDirection: 'row', marginBottom: 10, gap: 10, alignItems: 'flex-start' },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(52, 211, 153, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: Colors.green, fontSize: 12, fontWeight: '800' },
  stepText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  kbdMono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' } as const), color: Colors.green, fontSize: 12 },
  outlineBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.5)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  outlineBtnText: { color: Colors.green, fontWeight: '700', fontSize: 14 },
  mutedBottom: { ...Typography.caption, color: Colors.textMuted, lineHeight: 18, marginBottom: 8 },
  verifiedRow: {
    marginTop: 8,
    marginBottom: 4,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  verifiedText: { color: Colors.green, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  verifyBtn: {
    marginTop: 12,
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  verifyBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  tipNote: { marginTop: 4, backgroundColor: 'rgba(251, 191, 36, 0.08)' },
  row2: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  languageRow: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgInput,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageRowActive: {
    borderColor: Colors.green,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  languageLabel: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  languageLabelActive: { color: Colors.green },
  languageTick: { color: Colors.green, fontSize: 16, fontWeight: '800' },
  btnRow: { marginTop: 28, gap: 12 },
  btnPrimary: {
    backgroundColor: Colors.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 50,
  },
  btnPrimaryText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  btnSecondary: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 15 },
});
