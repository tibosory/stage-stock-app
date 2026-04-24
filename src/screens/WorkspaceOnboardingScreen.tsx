// Assistant de premier lancement (préparamétrage) — optionnel, étapes passables.
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
import { setWorkspaceOnboardingCompleted } from '../lib/workspaceOnboardingStorage';
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
import { getMateriel, getPrets, getConsommablesAlerte } from '../db/database';

type Step = 'welcome' | 'place' | 'server' | 'profile' | 'done';

function useSteps(isEmp: boolean): Step[] {
  return useMemo(
    () => (isEmp ? (['welcome', 'server', 'done'] as const) : (['welcome', 'place', 'server', 'profile', 'done'] as const)),
    [isEmp]
  );
}

export default function WorkspaceOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAppAuth();
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

  const finishAll = useCallback(async () => {
    setSaving(true);
    try {
      await setWorkspaceOnboardingCompleted();
      goApp();
    } finally {
      setSaving(false);
    }
  }, [goApp]);

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
    })();
  }, []);

  useEffect(() => {
    setServerVerified(false);
  }, [baseUrl, apiKey]);

  const openInstallerInBrowser = useCallback(async () => {
    const u = getWindowsServerInstallerUrl().trim();
    if (!u) {
      Alert.alert(
        'Aucun lien d’installateur',
        "L'APK n'a pas d'URL d'hébergement pour l'EXE. Définissez EXPO_PUBLIC_WINDOWS_INSTALLER_URL au build, ou " +
          'expo.extra (windowsInstallerUrl / installerGitHubRepo) dans app.json, puis reconstruisez l\u0027APK. ' +
          'Vous pouvez aussi transférer le fichier via la carte sur Android (Partager vers le PC).',
        [{ text: 'OK' }]
      );
      return;
    }
    if (await Linking.canOpenURL(u)) {
      await Linking.openURL(u);
    } else {
      Alert.alert('Lien de téléchargement', u, [{ text: 'OK' }]);
    }
  }, []);

  const advanceFromServer = useCallback(async () => {
    const t = baseUrl.trim();
    if (t && !looksLikeHttpUrl(t)) {
      Alert.alert(
        'URL invalide',
        "L'adresse doit commencer par http:// ou https://, ou laissez vide pour l'URL par défaut du build."
      );
      return;
    }
    setSaving(true);
    try {
      await setApiBaseOverride(t || null);
      await setApiKeyOverride(apiKey.trim() || null);
      const r = await getResolvedApiBase();
      setResolved(r);
      setIx(i => i + 1);
    } finally {
      setSaving(false);
    }
  }, [apiKey, baseUrl]);

  const handleVerifyServer = useCallback(async () => {
    const t = baseUrl.trim();
    if (t && !looksLikeHttpUrl(t)) {
      Alert.alert('URL invalide', "Utilisez http:// ou https://, par ex. http://192.168.0.5:8090", [{ text: 'OK' }]);
      return;
    }
    setServerVerifyBusy(true);
    try {
      await setApiBaseOverride(t || null);
      await setApiKeyOverride(apiKey.trim() || null);
      const r = await getResolvedApiBase();
      setResolved(r);
      const ping = await pingStageStockApi();
      if (ping.ok) {
        setServerVerified(true);
        await refreshConnection();
        Alert.alert("Connexion OK", "L'app joint l'API Stage Stock. Passez à l'étape suivante.");
      } else {
        setServerVerified(false);
        Alert.alert('Connexion impossible', ping.message, [{ text: 'OK' }]);
      }
    } catch (e) {
      setServerVerified(false);
      Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
    } finally {
      setServerVerifyBusy(false);
    }
  }, [apiKey, baseUrl, refreshConnection]);

  const onNext = useCallback(async () => {
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
      const t = baseUrl.trim();
      if (t && !looksLikeHttpUrl(t)) {
        Alert.alert(
          'URL invalide',
          "L'adresse doit commencer par http:// ou https://, ou laissez vide pour l'URL par défaut du build."
        );
        return;
      }
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
  }, [advanceFromServer, apiKey, baseUrl, goApp, profile, step, steps.length, theatreAddress, theatreName]);

  const onSkipStep = useCallback(() => {
    if (ix >= steps.length - 1) return;
    if (step === 'server') {
      void (async () => {
        const [base, key] = await Promise.all([getApiBaseOverride(), getApiKeyOverride()]);
        setBaseUrl(base ?? '');
        setApiKey(key ?? '');
        setIx(i => i + 1);
      })();
      return;
    }
    setIx(i => i + 1);
  }, [ix, step, steps.length]);

  if (!profile) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={Colors.green} />
        <Text style={styles.bootText}>Chargement…</Text>
      </View>
    );
  }

  return (
    <TabScreenSafeArea style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.progress}>
          Étape {stepNum} / {totalSteps}
        </Text>
        <TouchableOpacity
          onPress={() => void finishAll()}
          disabled={saving}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipAll}>Tout ignorer</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 'welcome' && (
          <>
            <Text style={styles.title} accessibilityRole="header">
              Bienvenue
            </Text>
            <Text style={styles.lead}>
              Quelques réglages utiles (lieu, connexion, vos coordonnées) en un fil guidé. Rien d’obligatoire : vous
              pouvez passer n’importe quelle étape, tout reste modifiable plus tard dans Paramètres, Réseau et
              Utilisateur.
            </Text>
            <Text style={styles.muted}>
              Cet assistant ne s’affiche qu’une seule fois après l’installation.
            </Text>
          </>
        )}

        {step === 'place' && (
          <>
            <Text style={styles.title}>Lieu (en-têtes, PDF, étiquettes)</Text>
            <Text style={styles.lead}>
              Nom de la salle ou de la structure, et l’adresse telle qu’elle doit apparaître sur les documents. Le logo
              se règle dans l’onglet Utilisateur.
            </Text>
            <Card style={{ marginTop: 12 }}>
              <Input label="Nom du lieu" value={theatreName} onChangeText={setTheatreName} placeholder="Ex. Théâtre …" />
              <Text style={styles.inputLabel}>Adresse (plusieurs lignes possibles)</Text>
              <TextInput
                style={styles.area}
                value={theatreAddress}
                onChangeText={setTheatreAddress}
                placeholder="Rue, CP, ville…"
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlignVertical="top"
              />
            </Card>
          </>
        )}

        {step === 'server' && (
          <>
            <Text style={styles.title}>Serveur Stage Stock (PC local)</Text>
            <Text style={styles.lead}>
              Étape optionnelle. Avec le serveur local, suivez les consignes et « Vérifier la connexion » quand cela
              vous arrange. Vous pouvez appuyer sur « Passer l&apos;étape » pour ne rien enregistrer ici, ou « Tout
              ignorer » en haut à droite pour quitter l&apos;assistant. Les réglages d&apos;URL se font aussi
              dans l&apos;onglet Réseau, plus tard.
            </Text>

            {Platform.OS === 'android' && (
              <View style={styles.installerBlock}>
                <Text style={styles.recipeTitle}>Téléchargement (Android)</Text>
                <Text style={styles.mutedBottom}>
                  Le fichier s&apos;enregistre sur le téléphone. Partagez-le (Bluetooth, câble, e-mail) vers le PC, puis
                  lancez-le en administrateur sur Windows.
                </Text>
                <WindowsInstallerCard />
              </View>
            )}

            {Platform.OS !== 'android' && (
              <Card style={styles.recipeCard}>
                <Text style={styles.recipeTitle}>Téléchargement (hors Android)</Text>
                <Text style={styles.recipeStep}>
                  Sur un PC, ouvrez l&apos;URL ci-dessous pour récupérer
                  <Text style={styles.kbdMono}> Stagestock-Installer.exe</Text> (iPhone, iPad, autre) ; vous pouvez
                  vous envoyer le lien par e-mail pour le lancer sur la machine Windows.
                </Text>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => void openInstallerInBrowser()}>
                  <Text style={styles.outlineBtnText}>Ouvrir le lien de l&apos;installateur Windows</Text>
                </TouchableOpacity>
              </Card>
            )}

            <Card style={styles.recipeCard}>
              <Text style={styles.recipeTitle}>Étapes sur le PC (installation)</Text>
              <View style={styles.stepLine}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>1</Text>
                </View>
                <Text style={styles.stepText}>
                  Téléchargez (ci-dessus) ou obtenez <Text style={styles.kbdMono}>Stagestock-Installer.exe</Text>.
                </Text>
              </View>
              <View style={styles.stepLine}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
                <Text style={styles.stepText}>
                  Exécutez l&apos;installateur : Suivant, dossier, Terminer. Acceptez l&apos;accès si Windows le
                  demande.
                </Text>
              </View>
              <View style={styles.stepLine}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <Text style={styles.stepText}>
                  Lancez <Text style={styles.kbdMono}>StageStock Local</Text> (bureau ou menu). Le service doit
                  rester actif, sur le même Wi-Fi que le téléphone.
                </Text>
              </View>
            </Card>

            <Card style={styles.recipeCard}>
              <Text style={styles.recipeTitle}>Jumelage avec l&apos;application</Text>
              <View style={styles.stepLine}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>4</Text>
                </View>
                <Text style={styles.stepText}>
                  Notez l&apos;adresse d&apos;API (souvent port <Text style={styles.kbdMono}>8090</Text> et
                  l&apos;IP du PC, ex. <Text style={styles.kbdMono}>http://192.168.0.5:8090</Text>).
                </Text>
              </View>
              <View style={styles.stepLine}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>5</Text>
                </View>
                <Text style={styles.stepText}>
                  Ouvrez sur le PC <Text style={styles.kbdMono}>http://&lt;IP_DU_PC&gt;:8090/pair.html</Text> (page de
                  jumelage, QR). Sur le mobile, scannez le QR, ou &quot;Ouvrir dans Stage Stock&quot; si proposé. Sinon
                  saisissiez l&apos;URL (étape 7) ici ou dans l&apos;onglet Réseau.
                </Text>
              </View>
              <View style={styles.stepLine}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>6</Text>
                </View>
                <Text style={styles.stepText}>
                  Le jumelage doit s&apos;afficher comme enregistré. Si cela bloque, vérifiez le pare-feu (port
                  8090) et que le mobile et le PC sont sur le même réseau.
                </Text>
              </View>
            </Card>

            {!!bundled && <Text style={styles.hintBox}>URL de build (référence) : {bundled || '—'}</Text>}
            {!!resolved && (
              <Text style={styles.hintBox}>
                URL effective pour l&apos;app (après sauvegarde / vérification) : {resolved}
              </Text>
            )}

            <Card style={{ marginTop: 8 }}>
              <Text style={styles.subCardTitle}>7 — Accès API (PocketBase)</Text>
              <Text style={styles.mutedBottom}>
                Saisissez l&apos;URL telle qu&apos;après jumelage, ou telle qu&apos;indique votre admin. Clé
                d&apos;API si besoin.
              </Text>
              <Input
                label="URL de base (https://… ou http://IP:port)"
                value={baseUrl}
                onChangeText={setBaseUrl}
                autoCapitalize="none"
                placeholder="Laissez vide pour l'adresse par défaut intégrée au build, si le build en définit une"
                keyboardType="url"
              />
              <Input
                label="Clé API (optionnel)"
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                placeholder="Si votre admin vous en a fourni une"
              />
              {serverVerified ? (
                <View style={styles.verifiedRow}>
                  <Text style={styles.verifiedText}>Dernière vérification : connexion OK</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.verifyBtn, (serverVerifyBusy || saving) && { opacity: 0.6 }]}
                onPress={() => void handleVerifyServer()}
                disabled={serverVerifyBusy || saving}
                accessibilityLabel="Vérifier la connexion au serveur"
              >
                {serverVerifyBusy ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.verifyBtnText}>Vérifier la connexion</Text>
                )}
              </TouchableOpacity>
            </Card>
          </>
        )}

        {step === 'profile' && (
          <>
            <Text style={styles.title}>Vos coordonnées</Text>
            <Text style={styles.lead}>
              Sert de signature sur les e-mails générés (devis, etc.). Tout est optionnel ici.
            </Text>
            <Card style={{ marginTop: 12 }}>
              <View style={styles.row2}>
                <View style={styles.half}>
                  <Input
                    label="Prénom"
                    value={profile.prenom}
                    onChangeText={t => setProfile(p => (p ? { ...p, prenom: t } : p))}
                  />
                </View>
                <View style={styles.half}>
                  <Input
                    label="Nom"
                    value={profile.nom}
                    onChangeText={t => setProfile(p => (p ? { ...p, nom: t } : p))}
                  />
                </View>
              </View>
              <Input
                label="Fonction"
                value={profile.fonction}
                onChangeText={t => setProfile(p => (p ? { ...p, fonction: t } : p))}
              />
              <Input
                label="Établissement"
                value={profile.etablissement}
                onChangeText={t => setProfile(p => (p ? { ...p, etablissement: t } : p))}
              />
              <Input
                label="Téléphone"
                value={profile.telephone}
                onChangeText={t => setProfile(p => (p ? { ...p, telephone: t } : p))}
                keyboardType="phone-pad"
              />
              <Input
                label="E-mail"
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
            <Text style={styles.title}>C&apos;est presque prêt</Text>
            <Text style={styles.lead}>
              Les rappels (prêts, contrôles, stocks bas) passent par les notifications. Vous pourrez les ajuster dans
              Paramètres.
            </Text>
            {serverVerified && (
              <View style={styles.verifiedRow}>
                <Text style={styles.verifiedText}>
                  {isConsumerApp()
                    ? "La connexion au serveur a été vérifiée. L'indicateur de connexion devrait s'afficher comme actif tant que le PC sert l'API."
                    : "La requête de vérification vers l'API a répondu. Le serveur est joint depuis cette app."}
                </Text>
              </View>
            )}
            {!serverVerified && !!baseUrl.trim() && (
              <Card style={styles.tipNote}>
                <Text style={styles.muted}>
                  Vous avez saisi une URL d&apos;API personnalisée sans la vérifier ici. Testez-la dans
                  l&apos;onglet Réseau afin d&apos;être sûr que l&apos;app rejoint le PC.
                </Text>
              </Card>
            )}
            <Card style={{ marginTop: 12 }}>
              <Text style={styles.muted}>
                En appuyant sur « Terminer », l’app demandera l’autorisation de notification si ce n’est pas déjà fait.
                Vous pouvez aussi continuer sans accorder, et ouvrir les réglages plus tard.
              </Text>
            </Card>
          </>
        )}

        <View style={styles.btnRow}>
          {step !== 'welcome' && step !== 'done' && (
            <TouchableOpacity
              style={[styles.btnSecondary, saving && { opacity: 0.5 }]}
              onPress={onSkipStep}
              disabled={saving}
            >
              <Text style={styles.btnSecondaryText}>Passer l’étape</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.btnPrimary, saving && { opacity: 0.75 }]}
            onPress={() => void onNext()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {step === 'welcome'
                  ? 'Commencer'
                  : step === 'done'
                    ? 'Terminer'
                    : 'Suivant'}
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
  skipAll: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
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
