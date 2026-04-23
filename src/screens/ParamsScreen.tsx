// src/screens/ParamsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import {
  getCategories, insertCategorie, deleteCategorie, categoryPathById,
  getLocalisations, insertLocalisation, deleteLocalisation,
  getAlertesEmail, insertAlerteEmail, deleteAlerteEmail,
  getStats, insertAppUser, listAppUsersAll, getMateriel, getPrets,
  getBeneficiaires, insertBeneficiaire, deleteBeneficiaire,
  getConsommablesAlerte,
} from '../db/database';
import { Categorie, Localisation, AlerteEmail, AppUser, AppUserRole, Beneficiaire } from '../types';
import { Card, Input, SelectPicker, TabScreenSafeArea } from '../components/UI';
import { LegalLinksParamsCard } from '../components/LegalLinks';
import { useAppAuth } from '../context/AuthContext';
import { requestNotificationPermission, reschedulePretReturnReminders } from '../lib/pretNotifications';
import { rescheduleVgpDueReminders } from '../lib/vgpNotifications';
import { rescheduleSeuilBasReminders } from '../lib/seuilNotifications';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  loadMailRecipientAlerteIds,
  saveMailRecipientAlerteIds,
  type NotificationPrefs,
} from '../lib/notificationPrefs';
import {
  getVgpNotificationAdvanceDays,
  setVgpNotificationAdvanceDays,
  clampVgpAdvanceDays,
} from '../lib/vgpPrefs';
import {
  scheduleTestLocalNotification,
  sendTestExpoPushToStaff,
  sendTestSmtpAlertEmail,
} from '../lib/notificationTest';

const ROLE_OPTIONS: { label: string; value: AppUserRole }[] = [
  { label: 'Administrateur', value: 'admin' },
  { label: 'Technicien', value: 'technicien' },
  { label: 'Emprunteur', value: 'emprunteur' },
];

function NotifRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 }}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.border, true: Colors.greenMuted }}
        thumbColor={value ? Colors.green : Colors.textMuted}
      />
      <Text style={{ color: Colors.textSecondary, flex: 1, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

export default function ParamsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { can, refreshSession } = useAppAuth();
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [localisations, setLocalisations] = useState<Localisation[]>([]);
  const [alertes, setAlertes] = useState<AlerteEmail[]>([]);
  const [stats, setStats] = useState({ totalMateriels: 0, enPret: 0, pretsEnCours: 0, alertesConsommables: 0 });

  const [newCat, setNewCat] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [alertNom, setAlertNom] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertRole, setAlertRole] = useState('');

  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [nuNom, setNuNom] = useState('');
  const [nuPin, setNuPin] = useState('');
  const [nuRole, setNuRole] = useState<AppUserRole>('technicien');

  const [vgpAdvanceDays, setVgpAdvanceDaysState] = useState('7');
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    pushPrets: true,
    pushVgpControle: true,
    pushSeuilBas: true,
    mailSuggestionSeuil: true,
    mailSuggestionVgp: true,
    mailSuggestionPrets: true,
    mailAutoSendWifiCellular: true,
  });
  const [mailRecipientIds, setMailRecipientIds] = useState<string[]>([]);
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [newBenNom, setNewBenNom] = useState('');
  const [newBenOrg, setNewBenOrg] = useState('');
  const [newBenTel, setNewBenTel] = useState('');
  const [newBenEmail, setNewBenEmail] = useState('');

  const [testMsgTitle, setTestMsgTitle] = useState('Stage Stock — test');
  const [testMsgBody, setTestMsgBody] = useState(
    'Vérifiez la réception des alertes et notifications.'
  );
  const [testBusy, setTestBusy] = useState<null | 'local' | 'push' | 'mail'>(null);

  const persistNotif = useCallback(async (partial: Partial<NotificationPrefs>) => {
    const next = await saveNotificationPrefs(partial);
    setNotifPrefs(next);
    const [prets, mats, seuils] = await Promise.all([
      getPrets(),
      getMateriel(),
      getConsommablesAlerte(),
    ]);
    await reschedulePretReturnReminders(prets);
    await rescheduleVgpDueReminders(mats);
    await rescheduleSeuilBasReminders(seuils);
  }, []);

  const load = useCallback(async () => {
    const [cats, locs, als, st, users, vgpAdv, bens, prefs, mids] = await Promise.all([
      getCategories(),
      getLocalisations(),
      getAlertesEmail(),
      getStats(),
      listAppUsersAll(),
      getVgpNotificationAdvanceDays(),
      getBeneficiaires(),
      loadNotificationPrefs(),
      loadMailRecipientAlerteIds(),
    ]);
    setCategories(cats);
    setLocalisations(locs);
    setAlertes(als);
    setBeneficiaires(bens);
    setStats(st);
    setAppUsers(users);
    setVgpAdvanceDaysState(String(vgpAdv));
    setNotifPrefs(prefs);
    setMailRecipientIds(mids);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshSession();
      void load();
    }, [load, refreshSession])
  );

  const addCategorie = async () => {
    if (!newCat.trim()) return;
    await insertCategorie(newCat.trim());
    setNewCat('');
    load();
  };

  const addLocalisation = async () => {
    if (!newLoc.trim()) return;
    await insertLocalisation(newLoc.trim());
    setNewLoc('');
    load();
  };

  const addAlerte = async () => {
    if (!alertEmail.trim()) {
      Alert.alert('Email requis');
      return;
    }
    await insertAlerteEmail({ nom: alertNom || undefined, email: alertEmail.trim(), role: alertRole || undefined });
    setAlertNom(''); setAlertEmail(''); setAlertRole('');
    load();
  };

  const addBeneficiaire = async () => {
    if (!newBenNom.trim()) {
      Alert.alert('Nom requis', 'Indiquez au moins le nom du bénéficiaire.');
      return;
    }
    await insertBeneficiaire({
      nom: newBenNom.trim(),
      organisation: newBenOrg.trim() || null,
      telephone: newBenTel.trim() || null,
      email: newBenEmail.trim() || null,
    });
    setNewBenNom('');
    setNewBenOrg('');
    setNewBenTel('');
    setNewBenEmail('');
    load();
  };

  const addAppUser = async () => {
    if (!nuNom.trim() || nuPin.length < 4) {
      Alert.alert('Utilisateur', 'Nom et PIN (min. 4 caractères) requis.');
      return;
    }
    await insertAppUser(nuNom.trim(), nuRole, nuPin);
    setNuNom('');
    setNuPin('');
    load();
    Alert.alert('✓', 'Utilisateur créé.');
  };

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28 + Math.max(insets.bottom, 12) }}
      >
        {/* Header */}
        <View style={s.headerRow}>
          <Text style={{ fontSize: 22, color: Colors.green }}>⚙️</Text>
          <Text style={s.title}>Paramètres</Text>
        </View>

        {/* Stats rapides — tap : ouvre l’écran / le filtre correspondant */}
        <View style={s.statsRow}>
          <StatCard
            label="Matériels"
            value={stats.totalMateriels}
            onPress={() =>
              navigation.navigate('Stock', {
                screen: 'StockList',
                params: { applyStatutFilter: 'tous' },
              })
            }
          />
          <StatCard
            label="En prêt"
            value={stats.enPret}
            color={Colors.yellow}
            onPress={() =>
              navigation.navigate('Stock', {
                screen: 'StockList',
                params: { applyStatutFilter: 'en prêt' },
              })
            }
          />
          <StatCard
            label="Prêts actifs"
            value={stats.pretsEnCours}
            color={Colors.blue}
            onPress={() => navigation.navigate('Prêts', { applyFiltreStatut: 'en cours' })}
          />
          <StatCard
            label="Alertes"
            value={stats.alertesConsommables}
            color={Colors.red}
            onPress={() => navigation.navigate('Consom.', { filterLowStock: true })}
          />
        </View>

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Notifications & e-mails</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 12 }}>
            Activez ou désactivez les rappels sur cet appareil et l’ouverture des brouillons d’e-mail. Les destinataires
            par défaut sont choisis parmi les adresses enregistrées ci-dessous (liste « Destinataires alertes email »).
            L’envoi automatique du récapitulatif d’alertes nécessite un serveur Stage Stock avec SMTP configuré
            (variables SMTP sur le backend).
          </Text>
          <NotifRow
            label="Notifications — prêts (retour)"
            value={notifPrefs.pushPrets}
            onValueChange={v => void persistNotif({ pushPrets: v })}
          />
          <NotifRow
            label="Notifications — VGP & contrôle EPI (échéances)"
            value={notifPrefs.pushVgpControle}
            onValueChange={v => void persistNotif({ pushVgpControle: v })}
          />
          <NotifRow
            label="Notifications — stocks consommables (seuil bas)"
            value={notifPrefs.pushSeuilBas}
            onValueChange={v => void persistNotif({ pushSeuilBas: v })}
          />
          <NotifRow
            label="E-mail — demande de devis (seuil bas)"
            value={notifPrefs.mailSuggestionSeuil}
            onValueChange={v => void persistNotif({ mailSuggestionSeuil: v })}
          />
          <NotifRow
            label="E-mail — rappels liés aux prêts (à venir)"
            value={notifPrefs.mailSuggestionPrets}
            onValueChange={v => void persistNotif({ mailSuggestionPrets: v })}
          />
          <NotifRow
            label="E-mail — rappels VGP / EPI (à venir)"
            value={notifPrefs.mailSuggestionVgp}
            onValueChange={v => void persistNotif({ mailSuggestionVgp: v })}
          />
          <NotifRow
            label="E-mail — envoi auto (Wi‑Fi ou 4G/5G) dès nouvelle alerte"
            value={notifPrefs.mailAutoSendWifiCellular}
            onValueChange={v => void persistNotif({ mailAutoSendWifiCellular: v })}
          />
          <Text style={[s.sectionTitle, { marginTop: 14 }]}>Destinataires par défaut (e-mails)</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 8 }}>
            Cochez les contacts utilisés pour préremplir le champ « À » des e-mails générés (ex. devis). Si aucune case
            n’est cochée, toutes les adresses enregistrées sont proposées.
          </Text>
          {alertes.map(al => (
            <View key={al.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
              <Switch
                value={mailRecipientIds.includes(al.id)}
                onValueChange={v => {
                  setMailRecipientIds(prev => {
                    const next = v ? [...prev, al.id] : prev.filter(id => id !== al.id);
                    void saveMailRecipientAlerteIds(next);
                    return next;
                  });
                }}
                trackColor={{ false: Colors.border, true: Colors.greenMuted }}
                thumbColor={mailRecipientIds.includes(al.id) ? Colors.green : Colors.textMuted}
              />
              <Text style={{ color: Colors.textSecondary, flex: 1, fontSize: 13 }}>{al.email}</Text>
            </View>
          ))}
          <Input
            label="Rappel VGP — jours avant l’échéance (0 = seulement le jour J)"
            value={vgpAdvanceDays}
            onChangeText={setVgpAdvanceDaysState}
            keyboardType="number-pad"
            placeholder="7"
            onBlur={async () => {
              const n = clampVgpAdvanceDays(parseInt(vgpAdvanceDays, 10));
              setVgpAdvanceDaysState(String(n));
              await setVgpNotificationAdvanceDays(n);
              await rescheduleVgpDueReminders(await getMateriel());
            }}
          />
          <TouchableOpacity
            style={s.syncBtn}
            onPress={async () => {
              const ok = await requestNotificationPermission();
              Alert.alert(
                ok ? 'Autorisé' : 'Refusé',
                ok ? 'Les rappels peuvent être planifiés.' : 'Activez les notifications dans les réglages du téléphone.'
              );
              if (ok) {
                await rescheduleVgpDueReminders(await getMateriel());
                await reschedulePretReturnReminders(await getPrets());
                await rescheduleSeuilBasReminders(await getConsommablesAlerte());
              }
            }}
          >
            <Text style={s.syncBtnText}>Demander la permission (notifications)</Text>
          </TouchableOpacity>

          {can('edit_inventory') && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 18 }]}>Test notifications & e-mail</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10, lineHeight: 16 }}>
                Titre et message personnalisables. « Locale » = sur cet appareil (~2 s). « Push » = jetons admin +
                technicien (Expo). « E-mail » = même envoi SMTP que les alertes automatiques (serveur + destinataires
                ci-dessus).
              </Text>
              <Input label="Titre du test" value={testMsgTitle} onChangeText={setTestMsgTitle} />
              <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Message</Text>
              <TextInput
                style={s.testBodyInput}
                value={testMsgBody}
                onChangeText={setTestMsgBody}
                multiline
                placeholder="Votre texte…"
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity
                style={[s.testBtn, testBusy === 'local' && s.testBtnDisabled]}
                disabled={testBusy !== null}
                onPress={async () => {
                  setTestBusy('local');
                  try {
                    const r = await scheduleTestLocalNotification(testMsgTitle, testMsgBody);
                    Alert.alert(r.ok ? 'OK' : 'Erreur', r.message);
                  } catch (e) {
                    Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
                  } finally {
                    setTestBusy(null);
                  }
                }}
              >
                {testBusy === 'local' ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={s.testBtnText}>Test notification locale (~2 s)</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.testBtn, s.testBtnSecondary, testBusy === 'push' && s.testBtnDisabled]}
                disabled={testBusy !== null}
                onPress={async () => {
                  setTestBusy('push');
                  try {
                    const r = await sendTestExpoPushToStaff({ title: testMsgTitle, body: testMsgBody });
                    Alert.alert(r.ok ? 'Push' : 'Push', r.message);
                  } catch (e) {
                    Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
                  } finally {
                    setTestBusy(null);
                  }
                }}
              >
                {testBusy === 'push' ? (
                  <ActivityIndicator color={Colors.green} />
                ) : (
                  <Text style={[s.testBtnText, s.testBtnTextSecondary]}>Test push Expo (admin & technicien)</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.testBtn, s.testBtnOutline, testBusy === 'mail' && s.testBtnDisabled]}
                disabled={testBusy !== null}
                onPress={async () => {
                  setTestBusy('mail');
                  try {
                    const r = await sendTestSmtpAlertEmail({
                      subject: testMsgTitle,
                      text: testMsgBody,
                    });
                    Alert.alert(r.ok ? 'E-mail' : 'E-mail', r.message);
                  } catch (e) {
                    Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
                  } finally {
                    setTestBusy(null);
                  }
                }}
              >
                {testBusy === 'mail' ? (
                  <ActivityIndicator color={Colors.green} />
                ) : (
                  <Text style={[s.testBtnText, s.testBtnTextOutline]}>Test e-mail (SMTP serveur)</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </Card>

        {can('manage_users') && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={s.sectionTitle}>Utilisateurs & rôles</Text>
            <Input label="Nom" value={nuNom} onChangeText={setNuNom} />
            <Input label="PIN" value={nuPin} onChangeText={setNuPin} keyboardType="number-pad" secureTextEntry />
            <SelectPicker label="Rôle" value={nuRole} options={ROLE_OPTIONS} onChange={v => setNuRole(v as AppUserRole)} />
            <TouchableOpacity style={s.addBtnFull} onPress={addAppUser}>
              <Text style={s.addBtnFullText}>+ Créer l’utilisateur</Text>
            </TouchableOpacity>
            {appUsers.map(u => (
              <View key={u.id} style={s.listItem}>
                <Text style={{ color: Colors.white }}>{u.nom}</Text>
                <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{u.role}{u.actif ? '' : ' (inactif)'}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Catégories */}
        {can('edit_inventory') && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, color: Colors.green }}>🏷️</Text>
            <Text style={s.sectionTitle}>Catégories (matériel & consommables)</Text>
          </View>
          <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10 }}>
            Sous-catégories : créez-les depuis l’écran Consommables lors de l’ajout d’un article.
          </Text>
          <View style={s.addRow}>
            <TextInput
              style={s.addInput}
              placeholder="Nouveau..."
              placeholderTextColor={Colors.textMuted}
              value={newCat}
              onChangeText={setNewCat}
              onSubmitEditing={addCategorie}
              returnKeyType="done"
            />
            <TouchableOpacity style={s.addBtn} onPress={addCategorie}>
              <Text style={{ color: Colors.white, fontSize: 20, fontWeight: 'bold' }}>+</Text>
            </TouchableOpacity>
          </View>
          {[...categories]
            .sort((a, b) =>
              categoryPathById(categories, a.id).localeCompare(categoryPathById(categories, b.id), 'fr', {
                sensitivity: 'base',
              })
            )
            .map(cat => (
            <View key={cat.id} style={s.listItem}>
              <Text style={{ color: Colors.white }}>{categoryPathById(categories, cat.id) || cat.nom}</Text>
              <TouchableOpacity onPress={() => {
                const label = categoryPathById(categories, cat.id) || cat.nom;
                Alert.alert('Supprimer', `Supprimer la catégorie « ${label} » ?`, [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => {
                      deleteCategorie(cat.id)
                        .then(load)
                        .catch(e => Alert.alert('Suppression impossible', e?.message ?? String(e)));
                    },
                  },
                ]);
              }}>
                <Text style={{ color: Colors.red, fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
        )}

        {/* Localisations */}
        {can('edit_inventory') && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, color: Colors.green }}>📍</Text>
            <Text style={s.sectionTitle}>Localisations</Text>
          </View>
          <View style={s.addRow}>
            <TextInput
              style={s.addInput}
              placeholder="Nouveau..."
              placeholderTextColor={Colors.textMuted}
              value={newLoc}
              onChangeText={setNewLoc}
              onSubmitEditing={addLocalisation}
              returnKeyType="done"
            />
            <TouchableOpacity style={s.addBtn} onPress={addLocalisation}>
              <Text style={{ color: Colors.white, fontSize: 20, fontWeight: 'bold' }}>+</Text>
            </TouchableOpacity>
          </View>
          {localisations.map(loc => (
            <View key={loc.id} style={s.listItem}>
              <Text style={{ color: Colors.white }}>{loc.nom}</Text>
              <TouchableOpacity onPress={() => {
                Alert.alert('Supprimer', `Supprimer "${loc.nom}" ?`, [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => deleteLocalisation(loc.id).then(load) },
                ]);
              }}>
                <Text style={{ color: Colors.red, fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
        )}

        {/* Répertoire bénéficiaires (prêts) */}
        {can('edit_inventory') && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, color: Colors.green }}>👤</Text>
            <Text style={s.sectionTitle}>Bénéficiaires (répertoire prêts)</Text>
          </View>
          <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10 }}>
            Fiches réutilisables lors de la création d’une feuille de prêt (liste déroulante).
          </Text>
          <Input label="Nom" value={newBenNom} onChangeText={setNewBenNom} placeholder="Nom complet" />
          <Input label="Organisation" value={newBenOrg} onChangeText={setNewBenOrg} placeholder="Optionnel" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input label="Téléphone" value={newBenTel} onChangeText={setNewBenTel} keyboardType="phone-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Email"
                value={newBenEmail}
                onChangeText={setNewBenEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
          <TouchableOpacity style={[s.addBtnFull, { marginTop: 10 }]} onPress={addBeneficiaire}>
            <Text style={s.addBtnFullText}>+ Ajouter au répertoire</Text>
          </TouchableOpacity>
          {beneficiaires.map(b => (
            <View key={b.id} style={s.listItem}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: Colors.white, fontWeight: '600' }}>{b.nom}</Text>
                {b.organisation ? (
                  <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{b.organisation}</Text>
                ) : null}
                <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                  {[b.telephone, b.email].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Supprimer', `Retirer « ${b.nom} » du répertoire ?`, [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Supprimer',
                      style: 'destructive',
                      onPress: () => deleteBeneficiaire(b.id).then(load),
                    },
                  ]);
                }}
              >
                <Text style={{ color: Colors.red, fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
        )}

        {/* Destinataires alertes email */}
        {can('edit_inventory') && (
        <Card style={{ marginBottom: 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, color: Colors.green }}>✉️</Text>
            <Text style={s.sectionTitle}>Destinataires alertes email</Text>
          </View>
          <TextInput
            style={[s.addInput, { marginBottom: 8 }]}
            placeholder="Nom"
            placeholderTextColor={Colors.textMuted}
            value={alertNom}
            onChangeText={setAlertNom}
          />
          <TextInput
            style={[s.addInput, { marginBottom: 8 }]}
            placeholder="Email *"
            placeholderTextColor={Colors.textMuted}
            value={alertEmail}
            onChangeText={setAlertEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={[s.addInput, { marginBottom: 12 }]}
            placeholder="Rôle"
            placeholderTextColor={Colors.textMuted}
            value={alertRole}
            onChangeText={setAlertRole}
          />
          <TouchableOpacity style={s.addBtnFull} onPress={addAlerte}>
            <Text style={s.addBtnFullText}>+ Ajouter</Text>
          </TouchableOpacity>

          {alertes.map(al => (
            <View key={al.id} style={s.listItem}>
              <View>
                <Text style={{ color: Colors.white }}>{al.email}</Text>
                {al.nom && <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{al.nom}</Text>}
              </View>
              <TouchableOpacity onPress={() => deleteAlerteEmail(al.id).then(load)}>
                <Text style={{ color: Colors.red, fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
        )}

        <LegalLinksParamsCard />
      </ScrollView>
    </TabScreenSafeArea>
  );
}

function StatCard({
  label,
  value,
  color = Colors.green,
  onPress,
}: {
  label: string;
  value: number;
  color?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={st.card}
      onPress={onPress}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value}, ouvrir la liste`}
    >
      <Text style={[st.value, { color }]}>{value}</Text>
      <Text style={st.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  value: { fontSize: 22, fontWeight: '800' },
  label: { color: Colors.textMuted, fontSize: 11, marginTop: 2, textAlign: 'center' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  sectionTitle: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  addInput: {
    flex: 1, backgroundColor: Colors.bgInput, borderRadius: 10,
    color: Colors.white, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border, fontSize: 14,
  },
  addBtn: {
    backgroundColor: Colors.green, borderRadius: 10, width: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnFull: {
    backgroundColor: Colors.green, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginBottom: 12,
  },
  addBtnFullText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  listItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  syncBtn: {
    backgroundColor: Colors.green, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  syncBtnText: { color: Colors.white, fontWeight: '600' },
  syncBtnOutline: {
    borderWidth: 1, borderColor: Colors.green, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  syncBtnTextOutline: { color: Colors.green, fontWeight: '600' },
  syncHint: { color: Colors.textMuted, fontSize: 11, marginTop: 10, textAlign: 'center' },
  testBodyInput: {
    minHeight: 80,
    backgroundColor: Colors.bgInput,
    borderRadius: 10,
    color: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  testBtn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginBottom: 8,
  },
  testBtnDisabled: { opacity: 0.55 },
  testBtnText: { color: Colors.white, fontWeight: '600' },
  testBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.green },
  testBtnTextSecondary: { color: Colors.green, fontWeight: '600' },
  testBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  testBtnTextOutline: { color: Colors.textSecondary, fontWeight: '600' },
});
