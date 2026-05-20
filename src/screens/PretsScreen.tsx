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
import { getMateriel } from '../db/inventoryDb';
import { getBeneficiaires, insertBeneficiaire, updateBeneficiaire } from '../db/metadataDb';
import {
  getPrets,
  getPretMateriel,
  updatePret,
  deletePret,
  insertPret,
  insertPretDemande,
  replacePretDemandeMateriels,
} from '../db/loanDb';
import { listAppUsersForLogin } from '../db/userDb';
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
import { useLanguage } from '../context/LanguageContext';

const STATUTS_PRET_VALUES: StatutPret[] = ['en demande', 'en cours', 'retourné', 'en retard', 'annulé'];

function formatDateCourt(raw: string | undefined): string {
  if (!raw) return '';
  const d = raw.includes('T') ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
  if (!isValid(d)) return raw;
  return format(d, 'd MMM yyyy', { locale: fr });
}

const FILTRE_PRETS: { key: 'tous' | StatutPret; label: string }[] = [
  { key: 'tous', label: 't.loans.filter.all' },
  { key: 'en demande', label: 't.loans.filter.requests' },
  { key: 'en cours', label: 't.loans.filter.active' },
  { key: 'en retard', label: 't.loans.filter.late' },
  { key: 'retourné', label: 't.loans.filter.returned' },
  { key: 'annulé', label: 't.loans.filter.cancelled' },
];

const ETATS_RET_VALUES: EtatMateriel[] = ['bon', 'moyen', 'usé', 'hors service'];

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
  const { t } = useLanguage();
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
    Alert.alert(t('loans.deleteTitle'), t('loans.deleteConfirm', { borrower: item.emprunteur }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('loans.deleteTitle'), style: 'destructive',
        onPress: async () => {
          try {
            await deletePret(item.id);
            load();
            void triggerSyncAfterActionIfEnabled();
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            Alert.alert(t('loans.deleteError'), msg);
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
      Alert.alert(t('loans.pdf'), e?.message ?? t('loans.exportImpossible'));
    }
  };

  const handleExportIcs = async () => {
    if (!exportOk) return;
    setExportingIcs(true);
    try {
      await exportPretsIcs();
    } catch (e: any) {
      Alert.alert(t('loans.icsExport'), e?.message ?? t('loans.exportImpossible'));
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
            {t('loans.row.period', {
              start: formatDateCourt(item.date_depart),
              end: item.retour_prevu ? ` -> ${formatDateCourt(item.retour_prevu)}` : '',
            })}
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
          title={t('loans.title')}
          rightLabel={isBorrower ? t('loans.newRequest') : t('loans.new')}
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
                <Text style={[s.chipText, active && s.chipTextActive]}>
                  {label.startsWith('t.') ? t(label.slice(2)) : label}
                </Text>
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
              accessibilityLabel={t('loans.a11y.exportIcs')}
            >
              {exportingIcs ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={s.icsBtnText}>{t('loans.exportIcs')}</Text>
              )}
            </TouchableOpacity>
            <Text style={s.icsHint}>
              {t('loans.exportIcsHint')}
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
              {filtreStatut === 'tous' ? t('loans.empty') : t('loans.emptyFilter')}
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
  const { t } = useLanguage();
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
  const statutOptions = useMemo(
    () =>
      STATUTS_PRET_VALUES.map(value => ({
        value,
        label:
          value === 'en demande'
            ? t('status.loan.pending')
            : value === 'en cours'
              ? t('status.loan.active')
              : value === 'retourné'
                ? t('status.loan.returned')
                : value === 'en retard'
                  ? t('status.loan.late')
                  : t('status.loan.cancelled'),
      })),
    [t]
  );
  const etatsRetourOptions = useMemo(
    () =>
      ETATS_RET_VALUES.map(value => ({
        value,
        label:
          value === 'bon'
            ? t('status.condition.good')
            : value === 'moyen'
              ? t('status.condition.medium')
              : value === 'usé'
                ? t('status.condition.worn')
                : t('status.condition.out_of_service'),
      })),
    [t]
  );

  const resolvedMaterielIds = useMemo(
    () => expandPretNameQtyToIds(nameGroups, qtyByNameKey),
    [nameGroups, qtyByNameKey]
  );

  const benOptions = useMemo(
    () => [
      { label: t('common.manualEntry'), value: '' },
      ...beneficiaires.map(b => ({
        label: b.organisation?.trim() ? `${b.nom} — ${b.organisation.trim()}` : b.nom,
        value: b.id,
      })),
    ],
    [beneficiaires, t]
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
      Alert.alert(t('loans.recipient.nameRequiredTitle'), t('loans.recipient.nameRequiredBody'));
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
      Alert.alert('✓', t('loans.recipient.created'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t('loans.error'), msg);
    }
  };

  const updateBeneficiaireRepertoire = async () => {
    if (!beneficiaireRepId) {
      Alert.alert(t('loans.recipient.directoryTitle'), t('loans.recipient.directoryBody'));
      return;
    }
    if (!emprunteur.trim()) {
      Alert.alert(t('loans.recipient.nameRequiredTitle'));
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
      Alert.alert('✓', t('loans.recipient.updated'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t('loans.error'), msg);
    }
  };

  const handleNotify = async () => {
    if (!item) return;
    setNotifyLoading(true);
    try {
      const r = await notifyStaffAboutBorrowerReturn(item, horairePrecision);
      Alert.alert(r.ok ? t('loans.notification') : t('loans.warning'), r.message);
    } finally {
      setNotifyLoading(false);
    }
  };

  const handleSave = async () => {
    if (readOnly && !borrowerCreatingDemande) return;
    if (!emprunteur.trim()) { Alert.alert(t('loans.field.required'), t('loans.field.borrowerRequired')); return; }
    if (!dateDepart) { Alert.alert(t('loans.field.required'), t('loans.field.startDateRequired')); return; }
    if (
      resolvedMaterielIds.length === 0 &&
      (borrowerCreatingDemande || (!item && statut === 'en demande'))
    ) {
      Alert.alert(t('loans.material'), t('loans.material.selectAtLeastOneForRequest'));
      return;
    }
    if (item?.statut === 'en demande' && statut === 'en cours' && resolvedMaterielIds.length === 0) {
      Alert.alert(t('loans.material'), t('loans.material.addBeforeValidation'));
      return;
    }
    const rappelTrim = rappelJoursAvant.trim();
    let rappel_jours_avant: number | null;
    if (rappelTrim === '') {
      rappel_jours_avant = null;
    } else {
      const n = parseInt(rappelTrim, 10);
      if (!Number.isFinite(n) || n < 1) {
        Alert.alert(t('loans.reminder.title'), t('loans.reminder.invalidBody'));
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
          if (!n.ok) Alert.alert(t('loans.warning'), n.message);
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
            if (!n.ok) Alert.alert(t('loans.warning'), n.message);
          }
        }
      }
      onSaved();
      void triggerSyncAfterActionIfEnabled();
      onClose();
    } catch (e: any) {
      Alert.alert(t('loans.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = borrowerCreatingDemande
    ? t('loans.modal.newRequest')
    : readOnly && item
      ? t('loans.modal.yourLoan')
      : item
        ? t('loans.modal.edit')
        : t('loans.modal.new');
  const formLocked = !!readOnly && !borrowerCreatingDemande;

  return (
    <BottomModal
      visible={visible}
      onClose={onClose}
      title={modalTitle}
    >
      {borrowerCreatingDemande ? (
        <Text style={{ color: Colors.textMuted, fontSize: 13, marginBottom: 14, lineHeight: 20 }}>
          {t('loans.requestInfo')}
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input
              label={t('loans.field.sheetNumber')}
              value={numeroFeuille}
              onChangeText={setNumeroFeuille}
              editable={!formLocked}
            />
          </View>
          <View style={{ flex: 1 }}>
            <SelectPicker
              label={t('loans.field.status')}
              value={statut}
              options={statutOptions}
              onChange={setStatut}
              disabled={formLocked}
            />
          </View>
        </View>
      )}

      {!borrowerCreatingDemande && (
        <>
          <SelectPicker
            label={t('loans.field.recipientFile')}
            value={beneficiaireRepId}
            options={benOptions}
            onChange={onBeneficiaireSelect}
            disabled={formLocked}
          />
          {!formLocked && (
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10 }}>
              {t('loans.field.recipientHint')}
            </Text>
          )}
        </>
      )}

      <Input
        label={t('loans.field.borrower')}
        value={emprunteur}
        onChangeText={setEmprunteur}
        placeholder={t('loans.field.fullName')}
        required
        editable={!formLocked && !borrowerCreatingDemande}
      />

      {authUser && authUser.role !== 'emprunteur' && (
        <SelectPicker
          label={t('loans.field.borrowerAccountOptional')}
          value={emprunteurUserId}
          options={[
            { label: t('common.noneLongDash'), value: '' },
            ...borrowerAccounts.map(u => ({ label: u.nom, value: u.id })),
          ]}
          onChange={setEmprunteurUserId}
          disabled={formLocked}
        />
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input
            label={t('loans.field.organization')}
            value={organisation}
            onChangeText={setOrganisation}
            editable={!formLocked}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label={t('loans.field.phone')}
            value={telephone}
            onChangeText={setTelephone}
            keyboardType="phone-pad"
            editable={!formLocked}
          />
        </View>
      </View>

      <Input
        label={t('loans.field.email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        editable={!formLocked}
      />

      {!formLocked && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <TouchableOpacity style={ms.repBtn} onPress={saveBeneficiaireToRepertoire}>
            <Text style={ms.repBtnText}>{t('loans.recipient.saveToDirectory')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ms.repBtnOutline} onPress={updateBeneficiaireRepertoire}>
            <Text style={ms.repBtnTextOut}>{t('loans.recipient.updateFile')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <DateField
            label={t('loans.field.startDate')}
            value={dateDepart}
            onChange={setDateDepart}
            required
            disabled={formLocked}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DateField
            label={t('loans.field.expectedReturn')}
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
            label={t('loans.field.reminderDays')}
            value={rappelJoursAvant}
            onChangeText={setRappelJoursAvant}
            keyboardType="number-pad"
            placeholder={t('loans.field.reminderPlaceholder')}
            editable={!formLocked}
          />
          {!formLocked && (
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: -4, marginBottom: 8 }}>
              {t('loans.field.reminderHint')}
            </Text>
          )}
        </>
      )}

      {!borrowerCreatingDemande && (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <DateField
              label={t('loans.field.actualReturn')}
              value={retourReel}
              onChange={setRetourReel}
              allowClear
              disabled={formLocked}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label={t('loans.field.estimatedValue')}
              value={valeurEstimee}
              onChangeText={setValeurEstimee}
              keyboardType="decimal-pad"
              editable={!formLocked}
            />
          </View>
        </View>
      )}

      <Input
        label={t('loans.field.comment')}
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
            <Text style={{ color: Colors.green, fontSize: 12, marginBottom: 8 }}>{t('loans.signature.captured')}</Text>
          )}
        </>
      ) : !borrowerCreatingDemande ? (
        <Text style={{ color: Colors.textMuted, fontSize: 13, marginBottom: 12 }}>
          {signatureB64 ? t('loans.signature.saved') : t('loans.signature.none')}
        </Text>
      ) : null}

      {item && lignesPret.length > 0 && !(item.statut === 'en demande' && !formLocked) && (
        <>
          <Text style={ms.sectionLabel}>{t('loans.materials.onSheet')}</Text>
          <View style={ms.matBox}>
            {lignesPret.map(l => (
              <View key={l.id} style={[ms.matRowCol, { opacity: l.retourne ? 0.55 : 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ color: Colors.white, flex: 1 }}>{l.materiel_nom ?? l.materiel_id}</Text>
                  {l.retourne ? (
                    <Text style={{ color: Colors.green, fontSize: 12 }}>{t('loans.material.returned')}</Text>
                  ) : (
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                      {item.statut === 'en demande' ? t('loans.material.onRequest') : t('loans.material.out')}
                    </Text>
                  )}
                </View>
                {statut === 'retourné' && !formLocked && (
                  <SelectPicker
                    label={t('loans.field.returnCondition')}
                    value={etatsRetour[l.materiel_id] ?? 'bon'}
                    options={etatsRetourOptions}
                    onChange={v =>
                      setEtatsRetour(prev => ({ ...prev, [l.materiel_id]: v as EtatMateriel }))
                    }
                  />
                )}
                {statut === 'retourné' && formLocked && (
                  <Text style={{ color: Colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    {t('loans.field.returnConditionValue')}{' '}
                    {etatsRetourOptions.find(e => e.value === (etatsRetour[l.materiel_id] ?? 'bon'))?.label ?? '—'}
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
            {borrowerCreatingDemande || item?.statut === 'en demande' ? t('loans.materials.requested') : t('loans.materials.loaned')}
          </Text>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 8, lineHeight: 18 }}>
            {t('loans.materials.selectionHint')}
          </Text>
          <View style={ms.matBox}>
            {allMateriels.length === 0 ? (
              <Text style={{ color: Colors.textMuted, fontSize: 13, paddingVertical: 8 }}>
                {t('loans.materials.noneAvailable')}
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
                        {t('loans.materials.availableChosen', { available: g.ids.length, chosen: q })}
                      </Text>
                    </View>
                    <View style={ms.qtyStepper}>
                      <TouchableOpacity
                        style={[ms.qtyStepBtn, q <= 0 && ms.qtyStepBtnOff]}
                        onPress={() => bumpNameQty(g.key, -1)}
                        disabled={q <= 0}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={t('loans.a11y.decreaseQty')}
                      >
                        <Text style={ms.qtyStepTxt}>−</Text>
                      </TouchableOpacity>
                      <Text style={ms.qtyValue}>{q}</Text>
                      <TouchableOpacity
                        style={[ms.qtyStepBtn, q >= g.ids.length && ms.qtyStepBtnOff]}
                        onPress={() => bumpNameQty(g.key, 1)}
                        disabled={q >= g.ids.length}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={t('loans.a11y.increaseQty')}
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
            label={t('loans.field.teamPrecision')}
            value={horairePrecision}
            onChangeText={setHorairePrecision}
            multiline
            placeholder={t('loans.field.teamPrecisionPlaceholder')}
          />
          <View style={{ flexDirection: 'row', marginTop: 16, marginBottom: 8, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <BtnSecondary label={t('common.close')} onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <BtnPrimary
                label={t('loans.notifyTeam')}
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
