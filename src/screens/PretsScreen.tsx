// src/screens/PretsScreen.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Colors } from '../theme/colors';
import {
  getPrets, updatePret, deletePret, getMateriel, getPretMateriel, insertPret, listAppUsersForLogin,
} from '../db/database';
import { Pret, Materiel, StatutPret, PretMateriel, EtatMateriel, AppUserRole, AppUser } from '../types';
import { PretStatutBadge, Card, ScreenHeader, BottomModal, Input, SelectPicker, FormButtons } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { exportFichePretPdf } from '../lib/pdfPretExport';
import { reschedulePretReturnReminders } from '../lib/pretNotifications';
import SignaturePad from '../components/SignaturePad';

const STATUTS_PRET = [
  { label: 'En cours', value: 'en cours' },
  { label: 'Retourné', value: 'retourné' },
  { label: 'En retard', value: 'en retard' },
  { label: 'Annulé', value: 'annulé' },
];

function formatDateCourt(raw: string | undefined): string {
  if (!raw) return '';
  const d = raw.includes('T') ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
  if (!isValid(d)) return raw;
  return format(d, 'd MMM yyyy', { locale: fr });
}

const FILTRE_PRETS: { key: 'tous' | StatutPret; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'en cours', label: 'En cours' },
  { key: 'en retard', label: 'Retard' },
  { key: 'retourné', label: 'Retournés' },
  { key: 'annulé', label: 'Annulés' },
];

const ETATS_RET: { label: string; value: EtatMateriel }[] = [
  { label: 'Bon', value: 'bon' },
  { label: 'Moyen', value: 'moyen' },
  { label: 'Usé', value: 'usé' },
  { label: 'Hors service', value: 'hors service' },
];

export default function PretsScreen() {
  const { user, can } = useAuth();
  const [prets, setPrets] = useState<Pret[]>([]);
  const [filtreStatut, setFiltreStatut] = useState<'tous' | StatutPret>('tous');
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Pret | null>(null);

  const load = useCallback(async () => {
    const p = await getPrets();
    setPrets(p);
    try {
      await reschedulePretReturnReminders(p);
    } catch {
      /* notifications optionnelles */
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pretsFiltres = useMemo(() => {
    let list = prets;
    if (user?.role === 'emprunteur') {
      list = list.filter(
        p =>
          p.emprunteur_user_id === user.id ||
          (!p.emprunteur_user_id && p.emprunteur.trim().toLowerCase() === user.nom.trim().toLowerCase())
      );
    }
    if (filtreStatut === 'tous') return list;
    return list.filter(p => p.statut === filtreStatut);
  }, [prets, filtreStatut, user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = (item: Pret) => {
    if (!can('delete_pret')) return;
    Alert.alert('Supprimer', `Supprimer le prêt "${item.emprunteur}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => { await deletePret(item.id); load(); }
      },
    ]);
  };

  const handleExportPdf = async (p: Pret) => {
    try {
      const lignes = await getPretMateriel(p.id);
      await exportFichePretPdf(p, lignes);
    } catch (e: any) {
      Alert.alert('PDF', e?.message ?? 'Export impossible');
    }
  };

  const renderItem = ({ item }: { item: Pret }) => (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.name}>{item.emprunteur}</Text>
          {item.organisation && <Text style={s.sub}>{item.organisation}</Text>}
          <Text style={s.sub}>
            Départ {formatDateCourt(item.date_depart)}
            {item.retour_prevu ? ` → retour ${formatDateCourt(item.retour_prevu)}` : ''}
          </Text>
        </View>
        <PretStatutBadge statut={item.statut} />
      </View>
      <View style={s.actions}>
        <TouchableOpacity onPress={() => handleExportPdf(item)} style={s.iconBtn}>
          <Text style={{ fontSize: 16 }}>📄</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setEditItem(item); setShowModal(true); }} style={s.iconBtn}>
          <Text style={{ fontSize: 18 }}>✏️</Text>
        </TouchableOpacity>
        {can('delete_pret') && (
          <TouchableOpacity onPress={() => handleDelete(item)} style={s.iconBtn}>
            <Text style={{ color: Colors.red, fontSize: 18 }}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <ScreenHeader
          icon={<Text style={{ fontSize: 22, color: Colors.green }}>📋</Text>}
          title="Prêts"
          rightLabel="Nouveau"
          onRightPress={() => { if (user) { setEditItem(null); setShowModal(true); } }}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
          style={{ marginBottom: 4 }}
        >
          {FILTRE_PRETS.map(({ key, label }) => {
            const active = filtreStatut === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setFiltreStatut(key)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={pretsFiltres}
        renderItem={renderItem}
        keyExtractor={(item: Pret) => item.id}
        contentContainerStyle={{ padding: 20, paddingTop: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>📋</Text>
            <Text style={{ color: Colors.textMuted, marginTop: 12 }}>
              {filtreStatut === 'tous' ? 'Aucun prêt enregistré' : 'Aucun prêt dans ce filtre'}
            </Text>
          </View>
        }
      />

      <PretModal
        visible={showModal}
        onClose={() => { setShowModal(false); setEditItem(null); }}
        onSaved={load}
        item={editItem}
        authUser={user}
      />
    </SafeAreaView>
  );
}

// ── Modal Prêt ────────────────────────────────────────────────────────────────
function PretModal({ visible, onClose, onSaved, item, authUser }: {
  visible: boolean; onClose: () => void; onSaved: () => void; item: Pret | null;
  authUser: AppUser | null;
}) {
  const [numeroFeuille, setNumeroFeuille] = useState('');
  const [statut, setStatut] = useState('en cours');
  const [emprunteur, setEmprunteur] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [dateDepart, setDateDepart] = useState('');
  const [retourPrevu, setRetourPrevu] = useState('');
  const [retourReel, setRetourReel] = useState('');
  const [valeurEstimee, setValeurEstimee] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [allMateriels, setAllMateriels] = useState<Materiel[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [lignesPret, setLignesPret] = useState<(PretMateriel & { materiel_nom?: string })[]>([]);
  const [signatureB64, setSignatureB64] = useState<string | null>(null);
  const [emprunteurUserId, setEmprunteurUserId] = useState('');
  const [borrowerAccounts, setBorrowerAccounts] = useState<{ id: string; nom: string; role: AppUserRole }[]>([]);
  const [etatsRetour, setEtatsRetour] = useState<Record<string, EtatMateriel>>({});

  useEffect(() => {
    if (!visible) return;
    listAppUsersForLogin().then(u =>
      setBorrowerAccounts(u.filter(x => x.role === 'emprunteur'))
    );
    getMateriel().then(m => setAllMateriels(m.filter(mat => mat.statut === 'en stock' || (item && mat.statut === 'en prêt'))));
    if (item) {
      setNumeroFeuille(item.numero_feuille ?? '');
      setStatut(item.statut);
      setEmprunteur(item.emprunteur);
      setOrganisation(item.organisation ?? '');
      setTelephone(item.telephone ?? '');
      setEmail(item.email ?? '');
      setDateDepart(item.date_depart);
      setRetourPrevu(item.retour_prevu ?? '');
      setRetourReel(item.retour_reel ?? '');
      setValeurEstimee(item.valeur_estimee?.toString() ?? '');
      setCommentaire(item.commentaire ?? '');
      setEmprunteurUserId(item.emprunteur_user_id ?? '');
      setSignatureB64(item.signature_emprunteur_data ?? null);
    } else {
      setNumeroFeuille(''); setStatut('en cours');
      setOrganisation(''); setTelephone(''); setEmail('');
      setDateDepart(format(new Date(), 'yyyy-MM-dd'));
      setRetourPrevu(''); setRetourReel(''); setValeurEstimee('');
      setCommentaire(''); setSelectedIds([]);
      setSignatureB64(null);
      setEmprunteurUserId('');
      if (authUser?.role === 'emprunteur') {
        setEmprunteur(authUser.nom);
        setEmprunteurUserId(authUser.id);
      } else {
        setEmprunteur('');
      }
    }
  }, [visible, item, authUser]);

  useEffect(() => {
    if (!visible || !item) {
      setLignesPret([]);
      setEtatsRetour({});
      return;
    }
    getPretMateriel(item.id).then(rows => {
      const r = rows as (PretMateriel & { materiel_nom?: string })[];
      setLignesPret(r);
      const m: Record<string, EtatMateriel> = {};
      for (const l of r) {
        m[l.materiel_id] = (l.etat_au_retour as EtatMateriel) ?? 'bon';
      }
      setEtatsRetour(m);
    });
  }, [visible, item]);

  const toggleMat = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!emprunteur.trim()) { Alert.alert('Champ requis', 'L\'emprunteur est obligatoire'); return; }
    if (!dateDepart) { Alert.alert('Champ requis', 'La date de départ est obligatoire'); return; }
    setSaving(true);
    try {
      const signedAt = signatureB64 ? new Date().toISOString() : undefined;
      const data: Parameters<typeof updatePret>[1] = {
        numero_feuille: numeroFeuille || undefined,
        statut: statut as Pret['statut'],
        emprunteur: emprunteur.trim(),
        organisation: organisation || undefined,
        telephone: telephone || undefined,
        email: email || undefined,
        date_depart: dateDepart,
        retour_prevu: retourPrevu || undefined,
        retour_reel:
          statut === 'retourné'
            ? (retourReel || format(new Date(), 'yyyy-MM-dd'))
            : (retourReel || undefined),
        valeur_estimee: valeurEstimee ? parseFloat(valeurEstimee) : undefined,
        commentaire: commentaire || undefined,
        emprunteur_user_id: emprunteurUserId || undefined,
      };
      if (signatureB64) {
        (data as any).signature_emprunteur_data = signatureB64;
        (data as any).signed_at = signedAt;
      }
      if (item) {
        await updatePret(
          item.id,
          data,
          statut === 'retourné'
            ? {
                lignesEtatRetour: lignesPret.map(l => ({
                  materiel_id: l.materiel_id,
                  etat_au_retour: etatsRetour[l.materiel_id] ?? 'bon',
                })),
              }
            : undefined
        );
      } else {
        const ins = {
          ...data,
          statut: 'en cours' as const,
          retour_reel: undefined,
        } as Omit<Pret, 'id' | 'created_at' | 'updated_at' | 'synced'>;
        if (signatureB64) {
          ins.signature_emprunteur_data = signatureB64;
          ins.signed_at = signedAt;
        }
        await insertPret(ins, selectedIds);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomModal
      visible={visible}
      onClose={onClose}
      title={item ? 'Modifier le prêt' : 'Nouvelle feuille de prêt'}
    >
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="N° feuille" value={numeroFeuille} onChangeText={setNumeroFeuille} />
        </View>
        <View style={{ flex: 1 }}>
          <SelectPicker label="Statut" value={statut} options={STATUTS_PRET} onChange={setStatut} />
        </View>
      </View>

      <Input
        label="Emprunteur"
        value={emprunteur}
        onChangeText={setEmprunteur}
        placeholder="Nom complet"
        required
      />

      {authUser && authUser.role !== 'emprunteur' && (
        <SelectPicker
          label="Compte emprunteur (optionnel)"
          value={emprunteurUserId}
          options={[
            { label: '— Aucun —', value: '' },
            ...borrowerAccounts.map(u => ({ label: u.nom, value: u.id })),
          ]}
          onChange={setEmprunteurUserId}
        />
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Organisation" value={organisation} onChangeText={setOrganisation} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Téléphone" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" />
        </View>
      </View>

      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Date départ *" value={dateDepart} onChangeText={setDateDepart} placeholder="2026-04-15" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Retour prévu" value={retourPrevu} onChangeText={setRetourPrevu} placeholder="2026-04-20" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Retour réel" value={retourReel} onChangeText={setRetourReel} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Valeur estimée (€)" value={valeurEstimee} onChangeText={setValeurEstimee} keyboardType="decimal-pad" />
        </View>
      </View>

      <Input label="Commentaire" value={commentaire} onChangeText={setCommentaire} multiline />

      <SignaturePad
        onOK={b64 => setSignatureB64(b64)}
        onClear={() => setSignatureB64(null)}
      />
      {signatureB64 && <Text style={{ color: Colors.green, fontSize: 12, marginBottom: 8 }}>Signature capturée</Text>}

      {item && lignesPret.length > 0 && (
        <>
          <Text style={ms.sectionLabel}>Matériels sur cette feuille</Text>
          <View style={ms.matBox}>
            {lignesPret.map(l => (
              <View key={l.id} style={[ms.matRowCol, { opacity: l.retourne ? 0.55 : 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ color: Colors.white, flex: 1 }}>{l.materiel_nom ?? l.materiel_id}</Text>
                  {l.retourne ? (
                    <Text style={{ color: Colors.green, fontSize: 12 }}>Rendu</Text>
                  ) : (
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Sorti</Text>
                  )}
                </View>
                {statut === 'retourné' && (
                  <SelectPicker
                    label="État au retour"
                    value={etatsRetour[l.materiel_id] ?? 'bon'}
                    options={ETATS_RET}
                    onChange={v =>
                      setEtatsRetour(prev => ({ ...prev, [l.materiel_id]: v as EtatMateriel }))
                    }
                  />
                )}
              </View>
            ))}
          </View>
        </>
      )}

      {/* Sélection matériels */}
      {!item && allMateriels.length > 0 && (
        <>
          <Text style={ms.sectionLabel}>Matériels prêtés</Text>
          <View style={ms.matBox}>
            {allMateriels.map(m => (
              <TouchableOpacity
                key={m.id}
                style={ms.matRow}
                onPress={() => toggleMat(m.id)}
              >
                <View style={[ms.checkbox, selectedIds.includes(m.id) && ms.checkboxActive]}>
                  {selectedIds.includes(m.id) && <Text style={{ color: Colors.white, fontSize: 10 }}>✓</Text>}
                </View>
                <Text style={{ color: Colors.white, flex: 1 }}>{m.nom}</Text>
                {m.numero_serie && <Text style={{ color: Colors.textMuted, fontSize: 12 }}>({m.numero_serie})</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <FormButtons onCancel={onClose} onSave={handleSave} loading={saving} />
    </BottomModal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  chipsRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.greenBg, borderColor: Colors.green },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: Colors.green },
  name: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 4 },
  iconBtn: { padding: 6 },
  empty: { alignItems: 'center', marginTop: 60 },
});

const ms = StyleSheet.create({
  sectionLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500', marginBottom: 8 },
  matBox: { backgroundColor: Colors.bgInput, borderRadius: 10, marginBottom: 16, overflow: 'hidden' },
  matRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  matRowCol: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 6 },
  checkbox: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: Colors.green, alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: Colors.green },
});
