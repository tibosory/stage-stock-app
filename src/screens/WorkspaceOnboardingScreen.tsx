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
import { getBundledDefaultApiBase, getResolvedApiBase } from '../config/stageStockApi';
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
        // eslint-disable-next-line no-alert
        const { Alert } = await import('react-native');
        Alert.alert(
          'URL invalide',
          'L’adresse doit commencer par http:// ou https://, ou laissez vide pour l’URL du build.'
        );
        return;
      }
      setSaving(true);
      try {
        await setApiBaseOverride(t || null);
        await setApiKeyOverride(apiKey.trim() || null);
        setIx(i => i + 1);
      } finally {
        setSaving(false);
      }
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
  }, [apiKey, baseUrl, goApp, profile, step, steps.length, theatreAddress, theatreName]);

  const onSkipStep = useCallback(() => {
    if (ix >= steps.length - 1) return;
    setIx(i => i + 1);
  }, [ix, steps.length]);

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
            <Text style={styles.title}>Connexion serveur (sync, alertes, IA)</Text>
            <Text style={styles.lead}>
              Si vous utilisez un serveur Stage Stock (PC local, cloud), indiquez son URL. Sinon laissez vide : l’app
              utilisera l’adresse intégrée au build, le cas échéant.
            </Text>
            {!!bundled && (
              <Text style={styles.hintBox}>URL de build (référence) : {bundled || '—'}</Text>
            )}
            {!!resolved && resolved !== baseUrl?.trim() && (
              <Text style={styles.hintBox}>Résolue actuellement : {resolved}</Text>
            )}
            <Card style={{ marginTop: 12 }}>
              <Input
                label="URL de base (https://… ou http://IP:port)"
                value={baseUrl}
                onChangeText={setBaseUrl}
                autoCapitalize="none"
                placeholder="Laissez vide pour conserver l’adresse par défaut"
                keyboardType="url"
              />
              <Input
                label="Clé API (optionnel)"
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                placeholder="Si votre admin vous en a fourni une"
              />
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
            <Text style={styles.title}>C’est presque prêt</Text>
            <Text style={styles.lead}>
              Les rappels (prêts, contrôles, stocks bas) passent par les notifications. Vous pourrez les ajuster dans
              Paramètres.
            </Text>
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
