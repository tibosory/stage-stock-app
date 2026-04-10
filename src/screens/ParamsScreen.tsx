// src/screens/ParamsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import {
  getCategories, insertCategorie, deleteCategorie,
  getLocalisations, insertLocalisation, deleteLocalisation,
  getAlertesEmail, insertAlerteEmail, deleteAlerteEmail,
  getStats, insertAppUser, listAppUsersAll,
} from '../db/database';
import { syncToSupabase, syncFromSupabase } from '../lib/supabase';
import { Categorie, Localisation, AlerteEmail, AppUser, AppUserRole } from '../types';
import { Card, Input, SelectPicker } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import {
  exportMaterielsCsv, exportConsommablesCsv, exportPretsCsv, importMaterielsFromCsv,
} from '../lib/csvExportImport';
import { requestNotificationPermission } from '../lib/pretNotifications';

const ROLE_OPTIONS: { label: string; value: AppUserRole }[] = [
  { label: 'Administrateur', value: 'admin' },
  { label: 'Technicien', value: 'technicien' },
  { label: 'Emprunteur', value: 'emprunteur' },
];

export default function ParamsScreen() {
  const { user, logout, can } = useAuth();
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [localisations, setLocalisations] = useState<Localisation[]>([]);
  const [alertes, setAlertes] = useState<AlerteEmail[]>([]);
  const [stats, setStats] = useState({ totalMateriels: 0, enPret: 0, pretsEnCours: 0, alertesConsommables: 0 });

  const [newCat, setNewCat] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [alertNom, setAlertNom] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertRole, setAlertRole] = useState('');

  const [syncing, setSyncing] = useState(false);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [nuNom, setNuNom] = useState('');
  const [nuPin, setNuPin] = useState('');
  const [nuRole, setNuRole] = useState<AppUserRole>('technicien');

  const load = useCallback(async () => {
    const [cats, locs, als, st, users] = await Promise.all([
      getCategories(), getLocalisations(), getAlertesEmail(), getStats(),
      listAppUsersAll(),
    ]);
    setCategories(cats);
    setLocalisations(locs);
    setAlertes(als);
    setStats(st);
    setAppUsers(users);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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

  const handleSync = async (direction: 'push' | 'pull') => {
    setSyncing(true);
    const fn = direction === 'push' ? syncToSupabase : syncFromSupabase;
    const result = await fn();
    setSyncing(false);
    if (result.ok) {
      Alert.alert('✓ Sync réussie', direction === 'push'
        ? 'Données envoyées vers le cloud'
        : 'Données reçues depuis le cloud');
    } else {
      Alert.alert('Erreur sync', result.error ?? 'Erreur inconnue');
    }
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
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Header */}
        <View style={s.headerRow}>
          <Text style={{ fontSize: 22, color: Colors.green }}>⚙️</Text>
          <Text style={s.title}>Paramètres</Text>
        </View>

        {/* Stats rapides */}
        <View style={s.statsRow}>
          <StatCard label="Matériels" value={stats.totalMateriels} />
          <StatCard label="En prêt" value={stats.enPret} color={Colors.yellow} />
          <StatCard label="Prêts" value={stats.pretsEnCours} color={Colors.blue} />
          <StatCard label="Alertes" value={stats.alertesConsommables} color={Colors.red} />
        </View>

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Session</Text>
          <Text style={{ color: Colors.textSecondary, marginBottom: 12 }}>
            {user?.nom} · {user?.role}
          </Text>
          <TouchableOpacity style={s.addBtnFull} onPress={logout}>
            <Text style={s.addBtnFullText}>Se déconnecter</Text>
          </TouchableOpacity>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Notifications locales</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 10 }}>
            Rappels J-1 et jour J pour les retours de prêt (à reprogrammer après chaque synchro des prêts).
          </Text>
          <TouchableOpacity
            style={s.syncBtn}
            onPress={async () => {
              const ok = await requestNotificationPermission();
              Alert.alert(ok ? 'Autorisé' : 'Refusé', ok ? 'Les rappels peuvent être planifiés.' : 'Activez les notifications dans les réglages du téléphone.');
            }}
          >
            <Text style={s.syncBtnText}>Demander la permission</Text>
          </TouchableOpacity>
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

        {can('export_data') && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={s.sectionTitle}>Import / export CSV</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity style={s.syncBtn} onPress={() => exportMaterielsCsv().catch(e => Alert.alert('Erreur', e.message))}>
                <Text style={s.syncBtnText}>Matériels</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.syncBtn} onPress={() => exportConsommablesCsv().catch(e => Alert.alert('Erreur', e.message))}>
                <Text style={s.syncBtnText}>Consommables</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.syncBtn} onPress={() => exportPretsCsv().catch(e => Alert.alert('Erreur', e.message))}>
                <Text style={s.syncBtnText}>Prêts</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[s.syncBtnOutline, { marginTop: 10 }]}
              onPress={async () => {
                const r = await importMaterielsFromCsv();
                Alert.alert('Import matériels', r.err ?? `${r.ok} ligne(s) importée(s).`);
                load();
              }}
            >
              <Text style={s.syncBtnTextOutline}>Importer matériels (CSV)</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Sync Supabase */}
        {can('params_sync') && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 16 }}>☁️</Text>
            <Text style={s.sectionTitle}>Synchronisation cloud</Text>
          </View>
          {syncing ? (
            <ActivityIndicator color={Colors.green} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[s.syncBtn, { flex: 1 }]} onPress={() => handleSync('push')}>
                <Text style={s.syncBtnText}>↑ Envoyer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.syncBtnOutline, { flex: 1 }]} onPress={() => handleSync('pull')}>
                <Text style={s.syncBtnTextOutline}>↓ Recevoir</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={s.syncHint}>Configurez votre URL Supabase dans src/lib/supabase.ts</Text>
        </Card>
        )}

        {/* Catégories */}
        {can('edit_inventory') && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 16, color: Colors.green }}>🏷️</Text>
            <Text style={s.sectionTitle}>Catégories de matériel</Text>
          </View>
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
          {categories.map(cat => (
            <View key={cat.id} style={s.listItem}>
              <Text style={{ color: Colors.white }}>{cat.nom}</Text>
              <TouchableOpacity onPress={() => {
                Alert.alert('Supprimer', `Supprimer "${cat.nom}" ?`, [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => deleteCategorie(cat.id).then(load) },
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
      </ScrollView>
    </SafeAreaView>
  );
}

const StatCard = ({ label, value, color = Colors.green }: { label: string; value: number; color?: string }) => (
  <View style={st.card}>
    <Text style={[st.value, { color }]}>{value}</Text>
    <Text style={st.label}>{label}</Text>
  </View>
);

const st = StyleSheet.create({
  card: { flex: 1, backgroundColor: Colors.bgCard, borderRadius: 10, padding: 10, alignItems: 'center' },
  value: { fontSize: 22, fontWeight: '800' },
  label: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
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
});
