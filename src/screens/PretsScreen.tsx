// src/screens/PretsScreen.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, ScrollView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Colors } from '../theme/colors';
import {
  getPrets, updatePret, deletePret, getMateriel, getPretMateriel, insertPret, insertPretDemande,
  replacePretDemandeMateriels, listAppUsersForLogin,
  getBeneficiaires, insertBeneficiaire, updateBeneficiaire,
} from '../db/database';
import {
  Pret, Materiel, StatutPret, PretMateriel, EtatMateriel, AppUserRole, AppUser, Beneficiaire,
} from '../types';
import {
  PretStatutBadge, Card, ScreenHeader, BottomModal, Input, SelectPicker, FormButtons, DateField,
  BtnPrimary, BtnSecondary, TabScreenSafeArea,
} from '../components/UI';
import { EyeIcon } from '../components/Icons';
import { useAppAuth } from '../context/AuthContext';
import { notifyStaffAboutBorrowerReturn } from '../lib/notifyStaffPretReturn';
import { notifyAdminsNewPretDemande, notifyBorrowerDemandeAcceptee } from '../lib/pretDemandeNotifications';
import { exportFichePretPdf } from '../lib/pdfPretExport';
import { reschedulePretReturnReminders } from '../lib/pretNotifications';
import { triggerSyncAfterActionIfEnabled } from '../lib/syncAfterAction';
import { exportPretsIcs } from '../lib/csvExportImport';
import SignaturePad from '../components/SignaturePad';

const STATUTS_PRET = [
  { label: 'En demande', value: 'en demande' },
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
  { key: 'en demande', label: 'Demandes' },
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

/** Même intitulé (hors casse / espaces) : on regroupe, sans tenir compte du n° de série, QR ou catégorie. */
function normPretMaterielName(n: string): string {
  return n.trim().toLowerCase();
}

type PretMaterielNameGroup = {
  key: string;
  displayName: string;
  ids: string[];
};

function buildPretMaterielNameGroups(materiels: Materiel[]): PretMaterielNameGroup[] {
  const acc = new Map<string, { displayName: string; ids: string[] }>();
  for (const mat of materiels) {
    const key = normPretMaterielName(mat.nom);
    if (!key) continue;
    let e = acc.get(key);
    if (!e) {
      e = { displayName: (mat.nom || '').trim() || mat.nom, ids: [] };
      acc.set(key, e);
    }
    e.ids.push(mat.id);
  }
  for (const e of acc.values()) {
    e.ids.sort((a, b) => a.localeCompare(b));
  }
  return Array.from(acc.entries())
    .map(([key, v]) => ({ key, displayName: v.displayName, ids: v.ids }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }));
}

function expandPretNameQtyToIds(
  groups: PretMaterielNameGroup[],
  qty: Record<string, number>
): string[] {
  const out: string[] = [];
  for (const g of groups) {
    const n = Math.min(
      g.ids.length,
      Math.max(0, Math.floor(qty[g.key] ?? 0))
    );
    out.push(...g.ids.slice(0, n));
  }
  return out;
}

export default function PretsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user, can } = useAppAuth();
  const exportOk = can('export_data');
  const isBorrower = user?.role === 'emprunteur';
  const [prets, setPrets] = useState<Pret[]>([]);
  const [filtreStatut, setFiltreStatut] = useState<'tous' | StatutPret>('tous');
  const [refreshing, setRefreshing] = useState(false);
  const [exportingIcs, setExportingIcs] = useState(false);
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

  /** Depuis Paramètres : carte « Prêts » → prêts actifs (en cours) */
  useFocusEffect(
    useCallback(() => {
      const apply = route.params?.applyFiltreStatut as 'tous' | StatutPret | undefined;
      if (apply === undefined || apply === null) return;
      setFiltreStatut(apply);
      navigation.setParams({ applyFiltreStatut: undefined } as never);
    }, [route.params?.applyFiltreStatut, navigation])
  );

  /** Depuis l’onglet admin « Demandes » : ouvrir la fiche pour modification */
  useFocusEffect(
    useCallback(() => {
      const openId = route.params?.openPretEditId as string | undefined;
      if (!openId) return;
      (async () => {
        const all = await getPrets();
        const p = all.find(x => x.id === openId);
        if (p) {
          setEditItem(p);
          setShowModal(true);
        }
        navigation.setParams({ openPretEditId: undefined } as never);
      })();
    }, [route.params?.openPretEditId, navigation])
  );

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
        onPress: async () => {
          try {
            await deletePret(item.id);
            load();
            void triggerSyncAfterActionIfEnabled();
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            Alert.alert('Suppression impossible', msg);
          }
        }
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

  const handleExportIcs = async () => {
    if (!exportOk) return;
    setExportingIcs(true);
    try {
      await exportPretsIcs();
    } catch (e: any) {
      Alert.alert('Export .ics', e?.message ?? 'Export impossible');
    } finally {
      setExportingIcs(false);
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
          {isBorrower ? <EyeIcon size={20} color={Colors.white} /> : <Text style={{ fontSize: 18 }}>✏️</Text>}
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
    <TabScreenSafeArea style={s.container}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <ScreenHeader
          icon={<Text style={{ fontSize: 22, color: Colors.green }}>📋</Text>}
          title="Prêts"
          rightLabel={isBorrower ? 'Nouvelle demande' : 'Nouveau'}
          onRightPress={() => {
            if (!user) return;
            setEditItem(null);
            setShowModal(true);
          }}
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
        {exportOk && (
          <View style={s.icsRow}>
            <TouchableOpacity
              style={[s.icsBtn, exportingIcs && { opacity: 0.65 }]}
              onPress={() => void handleExportIcs()}
              disabled={exportingIcs}
              accessibilityRole="button"
              accessibilityLabel="Exporter les dates de prêt au format calendrier ICS"
            >
              {exportingIcs ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={s.icsBtnText}>Exporter .ics (calendrier)</Text>
              )}
            </TouchableOpacity>
            <Text style={s.icsHint}>
              Départ → retour prévu, hors prêts annulés. Partage vers Outlook, Google Agenda, etc.
            </Text>
          </View>
        )}
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
        readOnly={isBorrower && !!editItem}
        borrowerNewDemand={isBorrower && !editItem}
      />
    </TabScreenSafeArea>
  );
}

// ── Modal Prêt ────────────────────────────────────────────────────────────────
function PretModal({ visible, onClose, onSaved, item, authUser, readOnly, borrowerNewDemand }: {
  visible: boolean; onClose: () => void; onSaved: () => void; item: Pret | null;
  authUser: AppUser | null;
  readOnly?: boolean;
  /** Emprunteur : création d’une demande (statut « en demande », sans sortir le stock). */
  borrowerNewDemand?: boolean;
}) {
  const borrowerCreatingDemande = !!borrowerNewDemand && !item;
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
  /** Quantité demandée par « nom normalisé » (regroupe les fiches au même libellé). */
  const [qtyByNameKey, setQtyByNameKey] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [lignesPret, setLignesPret] = useState<(PretMateriel & { materiel_nom?: string })[]>([]);
  const [signatureB64, setSignatureB64] = useState<string | null>(null);
  const [emprunteurUserId, setEmprunteurUserId] = useState('');
  const [borrowerAccounts, setBorrowerAccounts] = useState<{ id: string; nom: string; role: AppUserRole }[]>([]);
  const [etatsRetour, setEtatsRetour] = useState<Record<string, EtatMateriel>>({});
  /** Vide = rappel à J-1 (1 jour avant). Sinon entier ≥ 1. */
  const [rappelJoursAvant, setRappelJoursAvant] = useState('');
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [beneficiaireRepId, setBeneficiaireRepId] = useState('');
  const [horairePrecision, setHorairePrecision] = useState('');
  const [notifyLoading, setNotifyLoading] = useState(false);

  const nameGroups = useMemo(
    () => buildPretMaterielNameGroups(allMateriels),
    [allMateriels]
  );

  const resolvedMaterielIds = useMemo(
    () => expandPretNameQtyToIds(nameGroups, qtyByNameKey),
    [nameGroups, qtyByNameKey]
  );

  const benOptions = useMemo(
    () => [
      { label: '— Saisie libre —', value: '' },
      ...beneficiaires.map(b => ({
        label: b.organisation?.trim() ? `${b.nom} — ${b.organisation.trim()}` : b.nom,
        value: b.id,
      })),
    ],
    [beneficiaires]
  );

  useEffect(() => {
    if (!visible) {
      setQtyByNameKey({});
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    getBeneficiaires().then(setBeneficiaires);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    listAppUsersForLogin().then(u =>
      setBorrowerAccounts(u.filter(x => x.role === 'emprunteur'))
    );
    getMateriel().then(m => {
      const norm = (s: string | undefined | null) => (s ?? '').trim().toLowerCase();
      let list = m.filter(mat => {
        const st = norm(mat.statut);
        return (
          st === 'en stock' ||
          (item && norm(item.statut) !== 'en demande' && st === 'en prêt')
        );
      });
      if (item && norm(item.statut) === 'en demande') {
        list = m.filter(mat => norm(mat.statut) === 'en stock');
      }
      setAllMateriels(list);
    });
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
      setRappelJoursAvant(
        item.rappel_jours_avant != null && item.rappel_jours_avant !== undefined
          ? String(item.rappel_jours_avant)
          : ''
      );
      setBeneficiaireRepId('');
    } else {
      setNumeroFeuille(''); setStatut('en cours');
      setOrganisation(''); setTelephone(''); setEmail('');
      setDateDepart(format(new Date(), 'yyyy-MM-dd'));
      setRetourPrevu(''); setRetourReel(''); setValeurEstimee('');
      setCommentaire(''); setQtyByNameKey({});
      setSignatureB64(null);
      setEmprunteurUserId('');
      setRappelJoursAvant('');
      setBeneficiaireRepId('');
      if (authUser?.role === 'emprunteur') {
        setEmprunteur(authUser.nom);
        setEmprunteurUserId(authUser.id);
      } else {
        setEmprunteur('');
      }
    }
  }, [visible, item, authUser]);

  useEffect(() => {
    if (visible && readOnly && !item && !borrowerNewDemand) onClose();
  }, [visible, readOnly, item, borrowerNewDemand, onClose]);

  useEffect(() => {
    if (!visible) return;
    if (!item || item.statut !== 'en demande') return;
    if (lignesPret.length === 0) return;
    const q: Record<string, number> = {};
    for (const l of lignesPret) {
      const k = normPretMaterielName(l.materiel_nom ?? '');
      if (!k) continue;
      q[k] = (q[k] ?? 0) + 1;
    }
    setQtyByNameKey(q);
  }, [visible, item?.id, item?.statut, lignesPret]);

  useEffect(() => {
    if (nameGroups.length === 0) return;
    setQtyByNameKey(prev => {
      const next: Record<string, number> = { ...prev };
      let changed = false;
      for (const g of nameGroups) {
        const v = next[g.key];
        if (v != null && v > g.ids.length) {
          next[g.key] = g.ids.length;
          changed = true;
        }
      }
      for (const k of Object.keys(next)) {
        if (!nameGroups.some(g => g.key === k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [nameGroups]);

  useEffect(() => {
    if (!visible) setHorairePrecision('');
  }, [visible]);

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

  const bumpNameQty = (key: string, delta: number) => {
    const g = nameGroups.find(x => x.key === key);
    const max = g?.ids.length ?? 0;
    const cur = qtyByNameKey[key] ?? 0;
    const next = Math.min(Math.max(0, cur + delta), max);
    setQtyByNameKey(p => {
      const n = { ...p };
      if (next <= 0) delete n[key];
      else n[key] = next;
      return n;
    });
  };

  const onBeneficiaireSelect = (id: string) => {
    setBeneficiaireRepId(id);
    if (!id) return;
    const b = beneficiaires.find(x => x.id === id);
    if (!b) return;
    setEmprunteur(b.nom);
    setOrganisation(b.organisation ?? '');
    setTelephone(b.telephone ?? '');
    setEmail(b.email ?? '');
  };

  const saveBeneficiaireToRepertoire = async () => {
    if (!emprunteur.trim()) {
      Alert.alert('Nom requis', 'Renseignez au moins le nom pour enregistrer une fiche bénéficiaire.');
      return;
    }
    try {
      const id = await insertBeneficiaire({
        nom: emprunteur.trim(),
        organisation: organisation.trim() || null,
        telephone: telephone.trim() || null,
        email: email.trim() || null,
      });
      const list = await getBeneficiaires();
      setBeneficiaires(list);
      setBeneficiaireRepId(id);
      Alert.alert('✓', 'Bénéficiaire ajouté au répertoire.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Erreur', msg);
    }
  };

  const updateBeneficiaireRepertoire = async () => {
    if (!beneficiaireRepId) {
      Alert.alert(
        'Répertoire',
        'Choisissez une fiche dans la liste « Fiche bénéficiaire », ou enregistrez d’abord une nouvelle fiche avec « + Répertoire ».'
      );
      return;
    }
    if (!emprunteur.trim()) {
      Alert.alert('Nom requis');
      return;
    }
    try {
      await updateBeneficiaire(beneficiaireRepId, {
        nom: emprunteur.trim(),
        organisation: organisation.trim() || null,
        telephone: telephone.trim() || null,
        email: email.trim() || null,
      });
      setBeneficiaires(await getBeneficiaires());
      Alert.alert('✓', 'Fiche du répertoire mise à jour.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Erreur', msg);
    }
  };

  const handleNotify = async () => {
    if (!item) return;
    setNotifyLoading(true);
    try {
      const r = await notifyStaffAboutBorrowerReturn(item, horairePrecision);
      Alert.alert(r.ok ? 'Notification' : 'Attention', r.message);
    } finally {
      setNotifyLoading(false);
    }
  };

  const handleSave = async () => {
    if (readOnly && !borrowerCreatingDemande) return;
    if (!emprunteur.trim()) { Alert.alert('Champ requis', 'L\'emprunteur est obligatoire'); return; }
    if (!dateDepart) { Alert.alert('Champ requis', 'La date de départ est obligatoire'); return; }
    if (
      resolvedMaterielIds.length === 0 &&
      (borrowerCreatingDemande || (!item && statut === 'en demande'))
    ) {
      Alert.alert('Matériel', 'Sélectionnez au moins un matériel pour une demande de prêt.');
      return;
    }
    if (item?.statut === 'en demande' && statut === 'en cours' && resolvedMaterielIds.length === 0) {
      Alert.alert('Matériel', 'Ajoutez au moins un matériel à la demande avant validation.');
      return;
    }
    const rappelTrim = rappelJoursAvant.trim();
    let rappel_jours_avant: number | null;
    if (rappelTrim === '') {
      rappel_jours_avant = null;
    } else {
      const n = parseInt(rappelTrim, 10);
      if (!Number.isFinite(n) || n < 1) {
        Alert.alert(
          'Rappel',
          'Nombre de jours avant retour : entier ≥ 1, ou laissez vide pour le défaut (1 jour = J-1).'
        );
        return;
      }
      rappel_jours_avant = Math.min(365, n);
    }
    setSaving(true);
    try {
      const signedAt = signatureB64 ? new Date().toISOString() : undefined;
      const data: Parameters<typeof updatePret>[1] = {
        numero_feuille: numeroFeuille || undefined,
        statut: (borrowerCreatingDemande ? 'en demande' : statut) as Pret['statut'],
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
        rappel_jours_avant,
      };
      if (signatureB64) {
        (data as any).signature_emprunteur_data = signatureB64;
        (data as any).signed_at = signedAt;
      }
      if (item) {
        if (item.statut === 'en demande') {
          await replacePretDemandeMateriels(item.id, resolvedMaterielIds);
        }
        const wasDemande = item.statut === 'en demande';
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
        if (wasDemande && data.statut === 'en cours') {
          const list = await getPrets();
          const p = list.find(x => x.id === item.id);
          if (p) await notifyBorrowerDemandeAcceptee(p);
        }
      } else if (borrowerCreatingDemande) {
        const ins = {
          ...data,
          statut: 'en demande' as const,
          retour_reel: undefined,
        } as Omit<Pret, 'id' | 'created_at' | 'updated_at' | 'synced'>;
        if (signatureB64) {
          ins.signature_emprunteur_data = signatureB64;
          ins.signed_at = signedAt;
        }
        const newId = await insertPretDemande(ins, resolvedMaterielIds);
        const list = await getPrets();
        const created = list.find(x => x.id === newId);
        if (created) {
          const n = await notifyAdminsNewPretDemande(created);
          if (!n.ok) Alert.alert('Attention', n.message);
        }
      } else {
        const demande = statut === 'en demande';
        const ins = {
          ...data,
          statut: (demande ? 'en demande' : 'en cours') as Pret['statut'],
          retour_reel: undefined,
        } as Omit<Pret, 'id' | 'created_at' | 'updated_at' | 'synced'>;
        if (signatureB64) {
          ins.signature_emprunteur_data = signatureB64;
          ins.signed_at = signedAt;
        }
        let newId: string;
        if (demande) {
          newId = await insertPretDemande(ins, resolvedMaterielIds);
        } else {
          newId = await insertPret({ ...ins, statut: 'en cours' }, resolvedMaterielIds);
        }
        if (demande) {
          const list = await getPrets();
          const created = list.find(x => x.id === newId);
          if (created) {
            const n = await notifyAdminsNewPretDemande(created);
            if (!n.ok) Alert.alert('Attention', n.message);
          }
        }
      }
      onSaved();
      void triggerSyncAfterActionIfEnabled();
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = borrowerCreatingDemande
    ? 'Nouvelle demande de prêt'
    : readOnly && item
      ? 'Votre prêt'
      : item
        ? 'Modifier le prêt'
        : 'Nouvelle feuille de prêt';
  const formLocked = !!readOnly && !borrowerCreatingDemande;

  return (
    <BottomModal
      visible={visible}
      onClose={onClose}
      title={modalTitle}
    >
      {borrowerCreatingDemande ? (
        <Text style={{ color: Colors.textMuted, fontSize: 13, marginBottom: 14, lineHeight: 20 }}>
          Votre demande sera envoyée aux administrateurs. Vous recevrez une notification lorsqu’elle sera acceptée
          (le prêt passera alors en « en cours » et le matériel sera sorti du stock).
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input
              label="N° feuille"
              value={numeroFeuille}
              onChangeText={setNumeroFeuille}
              editable={!formLocked}
            />
          </View>
          <View style={{ flex: 1 }}>
            <SelectPicker
              label="Statut"
              value={statut}
              options={STATUTS_PRET}
              onChange={setStatut}
              disabled={formLocked}
            />
          </View>
        </View>
      )}

      {!borrowerCreatingDemande && (
        <>
          <SelectPicker
            label="Fiche bénéficiaire"
            value={beneficiaireRepId}
            options={benOptions}
            onChange={onBeneficiaireSelect}
            disabled={formLocked}
          />
          {!formLocked && (
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10 }}>
              Choisissez une fiche enregistrée (Paramètres) ou saisissez librement ci-dessous.
            </Text>
          )}
        </>
      )}

      <Input
        label="Emprunteur"
        value={emprunteur}
        onChangeText={setEmprunteur}
        placeholder="Nom complet"
        required
        editable={!formLocked && !borrowerCreatingDemande}
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
          disabled={formLocked}
        />
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Organisation"
            value={organisation}
            onChangeText={setOrganisation}
            editable={!formLocked}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Téléphone"
            value={telephone}
            onChangeText={setTelephone}
            keyboardType="phone-pad"
            editable={!formLocked}
          />
        </View>
      </View>

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        editable={!formLocked}
      />

      {!formLocked && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <TouchableOpacity style={ms.repBtn} onPress={saveBeneficiaireToRepertoire}>
            <Text style={ms.repBtnText}>+ Enregistrer au répertoire</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ms.repBtnOutline} onPress={updateBeneficiaireRepertoire}>
            <Text style={ms.repBtnTextOut}>Mettre à jour la fiche</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <DateField
            label="Date départ"
            value={dateDepart}
            onChange={setDateDepart}
            required
            disabled={formLocked}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DateField
            label="Retour prévu"
            value={retourPrevu}
            onChange={setRetourPrevu}
            allowClear
            disabled={formLocked}
          />
        </View>
      </View>

      {!borrowerCreatingDemande && (
        <>
          <Input
            label="Rappel (jours avant retour prévu)"
            value={rappelJoursAvant}
            onChangeText={setRappelJoursAvant}
            keyboardType="number-pad"
            placeholder="Vide = 1 jour (J-1), à 9 h"
            editable={!formLocked}
          />
          {!formLocked && (
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: -4, marginBottom: 8 }}>
              Ex. 7 pour un rappel une semaine avant. Laissez vide pour le comportement par défaut (veille du retour).
            </Text>
          )}
        </>
      )}

      {!borrowerCreatingDemande && (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <DateField
              label="Retour réel"
              value={retourReel}
              onChange={setRetourReel}
              allowClear
              disabled={formLocked}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Valeur estimée (€)"
              value={valeurEstimee}
              onChangeText={setValeurEstimee}
              keyboardType="decimal-pad"
              editable={!formLocked}
            />
          </View>
        </View>
      )}

      <Input
        label="Commentaire"
        value={commentaire}
        onChangeText={setCommentaire}
        multiline
        editable={!formLocked}
      />

      {!borrowerCreatingDemande && !formLocked ? (
        <>
          <SignaturePad
            onOK={b64 => setSignatureB64(b64)}
            onClear={() => setSignatureB64(null)}
          />
          {signatureB64 && (
            <Text style={{ color: Colors.green, fontSize: 12, marginBottom: 8 }}>Signature capturée</Text>
          )}
        </>
      ) : !borrowerCreatingDemande ? (
        <Text style={{ color: Colors.textMuted, fontSize: 13, marginBottom: 12 }}>
          {signatureB64 ? 'Signature enregistrée sur la feuille.' : 'Pas de signature sur cette feuille.'}
        </Text>
      ) : null}

      {item && lignesPret.length > 0 && !(item.statut === 'en demande' && !formLocked) && (
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
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                      {item.statut === 'en demande' ? 'Sur la demande' : 'Sorti'}
                    </Text>
                  )}
                </View>
                {statut === 'retourné' && !formLocked && (
                  <SelectPicker
                    label="État au retour"
                    value={etatsRetour[l.materiel_id] ?? 'bon'}
                    options={ETATS_RET}
                    onChange={v =>
                      setEtatsRetour(prev => ({ ...prev, [l.materiel_id]: v as EtatMateriel }))
                    }
                  />
                )}
                {statut === 'retourné' && formLocked && (
                  <Text style={{ color: Colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    État au retour :{' '}
                    {ETATS_RET.find(e => e.value === (etatsRetour[l.materiel_id] ?? 'bon'))?.label ?? '—'}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </>
      )}

      {/* Sélection matériels (nouveau prêt, nouvelle demande, ou demande en cours d’édition admin) */}
      {!formLocked && (!item || item.statut === 'en demande') && (
        <>
          <Text style={ms.sectionLabel}>
            {borrowerCreatingDemande || item?.statut === 'en demande' ? 'Matériels demandés' : 'Matériels prêtés'}
          </Text>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 8, lineHeight: 18 }}>
            Par nom d’article (insensible à la casse) : indiquez combien d’exemplaires emprunter, sans dépasser le
            nombre d’unités « en stock » partageant le même libellé (chaque fiche a son S/N / QR, non affichés ici).
          </Text>
          <View style={ms.matBox}>
            {allMateriels.length === 0 ? (
              <Text style={{ color: Colors.textMuted, fontSize: 13, paddingVertical: 8 }}>
                Aucun matériel « en stock » disponible pour la sélection. Les fiches déjà en prêt ou en réparation
                n’apparaissent pas ici — vérifiez le stock ou contactez un technicien.
              </Text>
            ) : (
              nameGroups.map(g => {
                const q = qtyByNameKey[g.key] ?? 0;
                return (
                  <View key={g.key} style={ms.matGroupRow}>
                    <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <Text style={{ color: Colors.white, fontWeight: '600' }} numberOfLines={2}>
                        {g.displayName}
                      </Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                        {g.ids.length} exemplaire{g.ids.length > 1 ? 's' : ''} disponible{g.ids.length > 1 ? 's' : ''}
                        {' · '}
                        {q > 0 ? `${q} choisi(s)` : '—'}
                      </Text>
                    </View>
                    <View style={ms.qtyStepper}>
                      <TouchableOpacity
                        style={[ms.qtyStepBtn, q <= 0 && ms.qtyStepBtnOff]}
                        onPress={() => bumpNameQty(g.key, -1)}
                        disabled={q <= 0}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Diminuer la quantité"
                      >
                        <Text style={ms.qtyStepTxt}>−</Text>
                      </TouchableOpacity>
                      <Text style={ms.qtyValue}>{q}</Text>
                      <TouchableOpacity
                        style={[ms.qtyStepBtn, q >= g.ids.length && ms.qtyStepBtnOff]}
                        onPress={() => bumpNameQty(g.key, 1)}
                        disabled={q >= g.ids.length}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Augmenter la quantité"
                      >
                        <Text style={ms.qtyStepTxt}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}

      {(!readOnly || borrowerCreatingDemande) && <FormButtons onCancel={onClose} onSave={handleSave} loading={saving} />}

      {readOnly && item && item.statut !== 'en demande' && (
        <>
          <Input
            label="Précision pour l’équipe (horaire, lieu de dépôt…)"
            value={horairePrecision}
            onChangeText={setHorairePrecision}
            multiline
            placeholder="Ex. retour demain à 17 h, dépôt au magasin…"
          />
          <View style={{ flexDirection: 'row', marginTop: 16, marginBottom: 8, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <BtnSecondary label="Fermer" onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <BtnPrimary
                label="Notifier l’équipe"
                onPress={() => void handleNotify()}
                loading={notifyLoading}
              />
            </View>
          </View>
        </>
      )}
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
  icsRow: { marginTop: 10, marginBottom: 4 },
  icsBtn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  icsBtnText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  icsHint: { color: Colors.textMuted, fontSize: 11, marginTop: 6, lineHeight: 16 },
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
  repBtn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  repBtnText: { color: Colors.white, fontWeight: '600', fontSize: 12 },
  repBtnOutline: {
    borderWidth: 1,
    borderColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  repBtnTextOut: { color: Colors.green, fontWeight: '600', fontSize: 12 },
  matGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  qtyStepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyStepBtn: {
    minWidth: 40,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyStepBtnOff: { backgroundColor: Colors.bgCardAlt, opacity: 0.5 },
  qtyStepTxt: { color: Colors.white, fontSize: 22, fontWeight: '700', marginTop: -2 },
  qtyValue: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', minWidth: 22, textAlign: 'center' },
});
