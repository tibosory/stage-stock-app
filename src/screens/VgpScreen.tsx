import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format, parseISO, addDays, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Colors } from '../theme/colors';
import {
  getMaterielsVgpSuivi,
  getMateriel,
  updateMateriel,
} from '../db/database';
import { Materiel } from '../types';
import { Card, ScreenHeader, BottomModal, Input, DateField, FormButtons, TabScreenSafeArea } from '../components/UI';
import { useAppAuth } from '../context/AuthContext';
import {
  isVgpActif,
  isVgpEpi,
  isVgpEnRetard,
  vgpProchaineEcheanceIso,
  shareVgpIcsFile,
} from '../lib/vgp';
import { rescheduleVgpDueReminders } from '../lib/vgpNotifications';
import { triggerSyncAfterActionIfEnabled } from '../lib/syncAfterAction';

function fmtDate(raw?: string | null): string {
  if (!raw?.trim()) return '—';
  const d = raw.includes('T') ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
  return isValid(d) ? format(d, 'd MMM yyyy', { locale: fr }) : raw;
}

type VgpSection = { title: string; data: Materiel[] };

export default function VgpScreen() {
  const navigation = useNavigation<any>();
  const { can } = useAppAuth();
  const editOk = can('edit_inventory');

  const [list, setList] = useState<Materiel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<'epi' | 'general'>('general');
  const [pickSearch, setPickSearch] = useState('');
  const [allMats, setAllMats] = useState<Materiel[]>([]);

  const [editMat, setEditMat] = useState<Materiel | null>(null);
  const [libelle, setLibelle] = useState('');
  const [periodicite, setPeriodicite] = useState('');
  const [derniere, setDerniere] = useState('');
  const [isEpi, setIsEpi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const [vgp, all] = await Promise.all([getMaterielsVgpSuivi(), getMateriel()]);
    setList(vgp);
    setAllMats(all);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openEdit = (m: Materiel) => {
    setEditMat(m);
    setLibelle(m.vgp_libelle ?? '');
    setPeriodicite(m.vgp_periodicite_jours != null ? String(m.vgp_periodicite_jours) : '');
    setDerniere(m.vgp_derniere_visite ?? '');
    setIsEpi(isVgpEpi(m));
  };

  const closeEdit = () => {
    setEditMat(null);
    setLibelle('');
    setPeriodicite('');
    setDerniere('');
    setIsEpi(false);
  };

  const saveEdit = async () => {
    if (!editMat) return;
    const j = parseInt(periodicite.trim(), 10);
    if (!periodicite.trim() || !Number.isFinite(j) || j <= 0) {
      Alert.alert('Périodicité', 'Indiquez un nombre de jours valide (ex. 365 pour 1 an, 180 pour 6 mois).');
      return;
    }
    setSaving(true);
    try {
      let prochainControle: string | undefined;
      if (derniere.trim()) {
        const base = derniere.includes('T') ? parseISO(derniere) : parseISO(`${derniere.trim()}T12:00:00`);
        if (isValid(base)) {
          prochainControle = format(addDays(base, j), 'yyyy-MM-dd');
        }
      }
      await updateMateriel(editMat.id, {
        vgp_libelle: libelle.trim() || null,
        vgp_periodicite_jours: j,
        vgp_derniere_visite: derniere.trim() || null,
        vgp_epi: isEpi ? 1 : 0,
        ...(prochainControle ? { prochain_controle: prochainControle } : {}),
      });
      await load();
      await rescheduleVgpDueReminders(await getMateriel());
      void triggerSyncAfterActionIfEnabled();
      closeEdit();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const retirerVgp = () => {
    if (!editMat) return;
    Alert.alert('Retirer du suivi VGP', `« ${editMat.nom} » ne sera plus suivi ici.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          await updateMateriel(editMat.id, {
            vgp_actif: 0,
            vgp_periodicite_jours: null,
            vgp_derniere_visite: null,
            vgp_libelle: null,
            vgp_epi: 0,
          });
          await load();
          await rescheduleVgpDueReminders(await getMateriel());
          void triggerSyncAfterActionIfEnabled();
          closeEdit();
        },
      },
    ]);
  };

  const marquerVisiteAujourdhui = async (m: Materiel) => {
    const j = m.vgp_periodicite_jours;
    if (!j || j <= 0) {
      Alert.alert('VGP', 'Définissez d’abord une périodicité pour cet équipement.');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const base = parseISO(`${today}T12:00:00`);
    const prochain = format(addDays(base, j), 'yyyy-MM-dd');
    try {
      await updateMateriel(m.id, {
        vgp_derniere_visite: today,
        prochain_controle: prochain,
      });
      await load();
      await rescheduleVgpDueReminders(await getMateriel());
      void triggerSyncAfterActionIfEnabled();
      Alert.alert('✓', 'Dernière visite enregistrée à la date du jour.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible');
    }
  };

  const handleExportIcs = async () => {
    const vgp = list.filter(m => isVgpActif(m));
    if (!vgp.length) {
      Alert.alert('Export', 'Aucun matériel dans le suivi VGP.');
      return;
    }
    setExporting(true);
    try {
      await shareVgpIcsFile(vgp);
    } catch (e: any) {
      Alert.alert('Export .ics', e?.message ?? 'Export impossible');
    } finally {
      setExporting(false);
    }
  };

  const pickCandidates = allMats.filter(
    m => !isVgpActif(m) && m.nom.toLowerCase().includes(pickSearch.trim().toLowerCase())
  );

  const addToVgp = async (m: Materiel) => {
    const epi = addKind === 'epi';
    await updateMateriel(m.id, {
      vgp_actif: 1,
      vgp_periodicite_jours: 365,
      vgp_libelle: epi ? 'Contrôle EPI' : null,
      vgp_derniere_visite: null,
      vgp_epi: epi ? 1 : 0,
    });
    setAddOpen(false);
    setPickSearch('');
    await load();
    await rescheduleVgpDueReminders(await getMateriel());
    void triggerSyncAfterActionIfEnabled();
    const fresh = (await getMateriel()).find(x => x.id === m.id);
    if (fresh) openEdit(fresh);
  };

  const epiSuivi = useMemo(
    () => list.filter(isVgpEpi).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [list]
  );
  const autresSuivi = useMemo(
    () => list.filter(m => !isVgpEpi(m)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [list]
  );
  const sections = useMemo((): VgpSection[] => {
    const out: VgpSection[] = [];
    if (epiSuivi.length) {
      out.push({
        title: 'EPI — équipements de protection individuelle',
        data: epiSuivi,
      });
    }
    if (autresSuivi.length) {
      out.push({
        title: 'Autres équipements (VGP)',
        data: autresSuivi,
      });
    }
    return out;
  }, [epiSuivi, autresSuivi]);

  const renderItem = ({ item: m }: { item: Materiel }) => {
    const proch = vgpProchaineEcheanceIso(m);
    const retard = isVgpEnRetard(m);
    const incomplet = !m.vgp_periodicite_jours || m.vgp_periodicite_jours <= 0;
    return (
      <Card>
        <TouchableOpacity onPress={() => editOk && openEdit(m)} activeOpacity={0.85}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={s.name}>{m.nom}</Text>
                {isVgpEpi(m) && (
                  <View style={s.epiPill}>
                    <Text style={s.epiPillText}>EPI</Text>
                  </View>
                )}
              </View>
              {m.vgp_libelle ? (
                <Text style={s.sub}>{m.vgp_libelle}</Text>
              ) : null}
              <Text style={s.sub}>
                Dernière visite : {fmtDate(m.vgp_derniere_visite)}
                {m.vgp_periodicite_jours ? ` · Tous les ${m.vgp_periodicite_jours} j` : ''}
              </Text>
              <Text style={[s.proch, retard && s.prochAlert, incomplet && s.prochWarn]}>
                Prochaine échéance : {proch ? fmtDate(proch) : incomplet ? 'À configurer' : '—'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              {retard ? (
                <View style={s.badgeRed}>
                  <Text style={s.badgeTxt}>Due</Text>
                </View>
              ) : proch ? (
                <View style={s.badgeOk}>
                  <Text style={s.badgeTxt}>OK</Text>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
        {editOk && (
          <View style={s.rowBtns}>
            <TouchableOpacity style={s.smallBtn} onPress={() => marquerVisiteAujourdhui(m)}>
              <Text style={s.smallBtnText}>Visite faite aujourd’hui</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.smallBtnOutline}
              onPress={() => navigation.navigate('MaterielDetail', { materielId: m.id })}
            >
              <Text style={s.smallBtnOutlineText}>Fiche</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    );
  };

  return (
    <TabScreenSafeArea style={s.container}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <ScreenHeader
          icon={<Text style={{ fontSize: 22, color: Colors.green }}>📅</Text>}
          title="VGP — visites périodiques"
        />
        <Text style={s.intro}>
          Équipements soumis à contrôles réglementaires ou maintenance obligatoire : périodicité, dernière visite,
          alertes dans l’onglet Alertes, export calendrier .ics.
        </Text>
        <Text style={s.epiIntro}>
          Zone <Text style={{ fontWeight: '700', color: Colors.green }}>EPI</Text> : casques, harnais, chaussures de
          sécurité, gants, lunettes, etc. — contrôle d’état, conformité et périodicité dédiés (souvent annuel).
        </Text>
        <Text style={s.notifHint}>
          Rappels sur le téléphone : demandez la permission et réglez le délai (jours avant l’échéance) dans l’onglet
          Paramètres (⚙️), section « Notifications locales ».
        </Text>
        <View style={s.toolbar}>
          <TouchableOpacity
            style={[s.mainBtn, exporting && { opacity: 0.6 }]}
            onPress={handleExportIcs}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={s.mainBtnText}>Exporter .ics</Text>
            )}
          </TouchableOpacity>
          {editOk && (
            <>
              <TouchableOpacity
                style={s.outlineBtnEpi}
                onPress={() => {
                  setAddKind('epi');
                  setAddOpen(true);
                }}
              >
                <Text style={s.outlineBtnEpiText}>+ EPI</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.outlineBtn}
                onPress={() => {
                  setAddKind('general');
                  setAddOpen(true);
                }}
              >
                <Text style={s.outlineBtnText}>+ Équipement</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <SectionList<Materiel, VgpSection>
        sections={sections}
        keyExtractor={m => m.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <Text style={s.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>📅</Text>
            <Text style={s.emptyText}>Aucun équipement en suivi VGP</Text>
            {editOk && (
              <Text style={s.emptyHint}>
                Utilisez « + EPI » pour les équipements de protection, ou « + Équipement » pour les autres contrôles
                périodiques.
              </Text>
            )}
          </View>
        }
      />

      <BottomModal
        visible={addOpen}
        onClose={() => {
          setAddOpen(false);
          setPickSearch('');
        }}
        title={addKind === 'epi' ? 'Ajouter un EPI au suivi' : 'Ajouter un équipement VGP'}
      >
        <Text style={s.modalHint}>
          {addKind === 'epi'
            ? 'Sélectionnez un matériel EPI (casque, harnais, etc.). Un libellé « Contrôle EPI » est proposé par défaut, modifiable ensuite.'
            : 'Choisissez un matériel à suivre pour ses visites / contrôles périodiques (hors zone EPI).'}
        </Text>
        <TextInput
          style={s.search}
          placeholder="Rechercher…"
          placeholderTextColor={Colors.textMuted}
          value={pickSearch}
          onChangeText={setPickSearch}
        />
        <View style={s.pickList}>
          {pickCandidates.slice(0, 80).length === 0 ? (
            <Text style={s.emptyPick}>Aucun résultat ou tout est déjà en VGP.</Text>
          ) : (
            pickCandidates.slice(0, 80).map(m => (
              <TouchableOpacity key={m.id} style={s.pickRow} onPress={() => addToVgp(m)}>
                <Text style={s.pickName}>{m.nom}</Text>
                <Text style={s.pickSub}>{m.marque ?? ''}{m.numero_serie ? ` · ${m.numero_serie}` : ''}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </BottomModal>

      <BottomModal
        visible={!!editMat}
        onClose={closeEdit}
        title={editMat ? `VGP — ${editMat.nom}` : 'VGP'}
      >
        {editMat && (
          <>
            <View style={s.epiSwitchRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.epiSwitchLabel}>Afficher dans la zone EPI</Text>
                <Text style={s.epiSwitchHint}>
                  Casques, harnais, chaussures de sécurité, EPI soumis à contrôle visuel / périodique.
                </Text>
              </View>
              <Switch
                value={isEpi}
                onValueChange={setIsEpi}
                trackColor={{ false: Colors.border, true: Colors.green }}
                thumbColor={Colors.white}
              />
            </View>
            <Input
              label="Type de contrôle / référence"
              value={libelle}
              onChangeText={setLibelle}
              placeholder={isEpi ? 'ex. Contrôle EPI, harnais CE, date textile…' : 'ex. Consuel, extincteurs…'}
            />
            <Input
              label="Périodicité (jours)"
              value={periodicite}
              onChangeText={setPeriodicite}
              keyboardType="numeric"
              placeholder="ex. 365"
            />
            <DateField label="Date dernière visite / contrôle" value={derniere} onChange={setDerniere} allowClear />
            <Text style={s.modalHint}>
              La prochaine échéance = dernière visite + périodicité. Elle alimente aussi le champ « Prochain contrôle »
              de la fiche matériel.
            </Text>
            <FormButtons onCancel={closeEdit} onSave={saveEdit} loading={saving} />
            {editOk && (
              <TouchableOpacity style={s.dangerBtn} onPress={retirerVgp}>
                <Text style={s.dangerBtnText}>Retirer du suivi VGP</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </BottomModal>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  intro: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8, marginBottom: 6 },
  notifHint: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 12,
    opacity: 0.95,
  },
  toolbar: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: Colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    flex: 1,
  },
  sectionCount: {
    color: Colors.green,
    fontSize: 12,
    fontWeight: '700',
  },
  epiIntro: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  mainBtn: {
    backgroundColor: Colors.green,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    minWidth: 130,
    alignItems: 'center',
  },
  mainBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: Colors.green,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  outlineBtnText: { color: Colors.green, fontWeight: '700', fontSize: 14 },
  outlineBtnEpi: {
    borderWidth: 1,
    borderColor: Colors.yellow,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
  },
  outlineBtnEpiText: { color: Colors.yellow, fontWeight: '700', fontSize: 14 },
  epiPill: {
    backgroundColor: 'rgba(234, 179, 8, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  epiPillText: { color: Colors.yellow, fontSize: 10, fontWeight: '800' },
  epiSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  epiSwitchLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  epiSwitchHint: { color: Colors.textMuted, fontSize: 11, marginTop: 4, lineHeight: 15 },
  name: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  proch: { color: Colors.textMuted, fontSize: 13, marginTop: 6, fontWeight: '600' },
  prochAlert: { color: Colors.red },
  prochWarn: { color: Colors.yellow },
  badgeRed: { backgroundColor: Colors.red, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeOk: { backgroundColor: Colors.greenBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  smallBtn: { backgroundColor: Colors.bgCardAlt, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  smallBtnText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  smallBtnOutline: { borderWidth: 1, borderColor: Colors.border, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  smallBtnOutlineText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 20 },
  emptyText: { color: Colors.textMuted, marginTop: 12, fontSize: 15 },
  emptyHint: { color: Colors.textMuted, marginTop: 8, fontSize: 12, textAlign: 'center' },
  modalHint: { color: Colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 16 },
  search: {
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.white,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickList: { maxHeight: 320 },
  pickRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickName: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  pickSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  emptyPick: { color: Colors.textMuted, paddingVertical: 16, textAlign: 'center' },
  dangerBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  dangerBtnText: { color: Colors.red, fontWeight: '700', fontSize: 14 },
});
