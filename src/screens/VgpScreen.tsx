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
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO, addDays, isValid } from 'date-fns';
import { Colors } from '../theme/colors';
import { getMaterielsVgpSuivi } from '../db/inventoryOpsDb';
import {
  getMateriel,
  updateMateriel,
} from '../db/inventoryDb';
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
import { syncMaterielNoticeAttachments } from '../lib/materielAttachments';
import { pushMaterielNoticesToSupabaseAfterSave } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { getDateFnsLocale } from '../i18n/dateLocales';

function fmtDate(raw: string | null | undefined, language: 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt'): string {
  if (!raw?.trim()) return '—';
  const d = raw.includes('T') ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
  return isValid(d) ? format(d, 'd MMM yyyy', { locale: getDateFnsLocale(language) }) : raw;
}

type VgpSection = { title: string; data: Materiel[] };

export default function VgpScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { can } = useAppAuth();
  const { t, language } = useLanguage();
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

  const docPickUri = (pick: DocumentPicker.DocumentPickerResult): string | null => {
    if (pick.canceled) return null;
    const p = pick as DocumentPicker.DocumentPickerSuccessResult;
    return p.assets?.[0]?.uri ?? null;
  };

  const openControlReportPdf = async (m: Materiel) => {
    const target = m.notice_pdf_local ?? m.notice_pdf_url;
    if (!target) {
      Alert.alert(t('vgp.report.onlineTitle'), t('vgp.report.none'));
      return;
    }
    try {
      if (target.startsWith('http://') || target.startsWith('https://')) {
        Alert.alert(
          t('vgp.report.onlineTitle'),
          t('vgp.report.onlineHint')
        );
        return;
      }
      const shareOk = await Sharing.isAvailableAsync();
      if (!shareOk) {
        Alert.alert(t('vgp.report.onlineTitle'), t('vgp.shareUnavailable'));
        return;
      }
      await Sharing.shareAsync(target, {
        mimeType: 'application/pdf',
        dialogTitle: t('vgp.shareDialogTitle'),
      });
    } catch (e: any) {
      Alert.alert(t('vgp.report.onlineTitle'), e?.message ?? t('vgp.report.openFail'));
    }
  };

  const attachControlReportPdf = async (m: Materiel) => {
    if (!editOk) return;
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      const uri = docPickUri(pick);
      if (!uri) return;
      const localPatch = await syncMaterielNoticeAttachments(m.id, uri, undefined);
      if (Object.keys(localPatch).length) await updateMateriel(m.id, localPatch);
      const urlPatch = await pushMaterielNoticesToSupabaseAfterSave(m.id, localPatch);
      if (Object.keys(urlPatch).length) await updateMateriel(m.id, urlPatch);
      await load();
      void triggerSyncAfterActionIfEnabled();
      Alert.alert(t('vgp.report.attachedOk'), t('vgp.report.attachedBody'));
    } catch (e: any) {
      Alert.alert(t('vgp.report.onlineTitle'), e?.message ?? t('vgp.report.pickFail'));
    }
  };

  const removeControlReportPdf = (m: Materiel) => {
    if (!editOk) return;
    if (!m.notice_pdf_local && !m.notice_pdf_url) return;
    Alert.alert(t('vgp.report.removeTitle'), t('vgp.report.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('vgp.report.removeBtn'),
        style: 'destructive',
        onPress: async () => {
          try {
            const localPatch = await syncMaterielNoticeAttachments(m.id, '', undefined);
            if (Object.keys(localPatch).length) await updateMateriel(m.id, localPatch);
            const urlPatch = await pushMaterielNoticesToSupabaseAfterSave(m.id, localPatch);
            if (Object.keys(urlPatch).length) await updateMateriel(m.id, urlPatch);
            await load();
            void triggerSyncAfterActionIfEnabled();
          } catch (e: any) {
            Alert.alert(t('vgp.report.onlineTitle'), e?.message ?? t('tour.detail.photoDeleteError'));
          }
        },
      },
    ]);
  };

  const saveEdit = async () => {
    if (!editMat) return;
    const j = parseInt(periodicite.trim(), 10);
    if (!periodicite.trim() || !Number.isFinite(j) || j <= 0) {
      Alert.alert(t('vgp.period.invalidTitle'), t('vgp.period.invalidBody'));
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
      Alert.alert(t('common.error'), e?.message ?? t('tour.detail.actionError'));
    } finally {
      setSaving(false);
    }
  };

  const retirerVgp = () => {
    if (!editMat) return;
    Alert.alert(t('vgp.removeFollowTitle'), t('vgp.removeFollowBody', { name: editMat.nom }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('vgp.report.removeBtn'),
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
      Alert.alert(t('tab.vgp'), t('vgp.needPeriod'));
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
      Alert.alert(t('common.success'), t('vgp.visitSaved'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? t('tour.detail.actionError'));
    }
  };

  const handleExportIcs = async () => {
    const vgp = list.filter(m => isVgpActif(m));
    if (!vgp.length) {
      Alert.alert(t('tab.importExport'), t('vgp.export.none'));
      return;
    }
    setExporting(true);
    try {
      await shareVgpIcsFile(vgp);
    } catch (e: any) {
      Alert.alert(t('vgp.export.failTitle'), e?.message ?? t('importExport.failGeneric'));
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
      vgp_libelle: epi ? t('vgp.pick.defaultEpiLabel') : null,
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
    () => list.filter(isVgpEpi).sort((a, b) => a.nom.localeCompare(b.nom, language)),
    [list]
  );
  const autresSuivi = useMemo(
    () => list.filter(m => !isVgpEpi(m)).sort((a, b) => a.nom.localeCompare(b.nom, language)),
    [list]
  );
  const sections = useMemo((): VgpSection[] => {
    const out: VgpSection[] = [];
    if (epiSuivi.length) {
      out.push({
        title: t('vgp.sec.epiTitle'),
        data: epiSuivi,
      });
    }
    if (autresSuivi.length) {
      out.push({
        title: t('vgp.sec.otherTitle'),
        data: autresSuivi,
      });
    }
    return out;
  }, [epiSuivi, autresSuivi, t]);
  const bottomSafePad =
    Platform.OS === 'android' ? Math.max(insets.bottom, 64) : Math.max(insets.bottom, 16);

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
                {t('vgp.row.lastVisit', { date: fmtDate(m.vgp_derniere_visite, language) })}
                {m.vgp_periodicite_jours ? t('vgp.row.everyDays', { n: m.vgp_periodicite_jours }) : ''}
              </Text>
              {!!(m.notice_pdf_local || m.notice_pdf_url) && (
                <Text style={s.subReport}>Dernier rapport PDF joint</Text>
              )}
              <Text style={[s.proch, retard && s.prochAlert, incomplet && s.prochWarn]}>
                {t('vgp.row.nextDue', {
                  due: proch ? fmtDate(proch, language) : incomplet ? t('vgp.row.nextIncomplete') : t('vgp.row.nextDash'),
                })}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              {retard ? (
                <View style={s.badgeRed}>
                  <Text style={s.badgeTxt}>{t('vgp.badgeDue')}</Text>
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
              <Text style={s.smallBtnText}>{t('vgp.visitToday')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.smallBtnOutline}
              onPress={() => navigation.navigate('MaterielDetail', { materielId: m.id })}
            >
              <Text style={s.smallBtnOutlineText}>{t('vgp.openCard')}</Text>
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
          title={t('vgp.header.title')}
        />
        <Text style={s.intro}>{t('vgp.header.intro')}</Text>
        <Text style={s.epiIntro}>{t('vgp.header.epiZone')}</Text>
        <Text style={s.notifHint}>{t('vgp.header.notifyHint')}</Text>
        <View style={s.toolbar}>
          <TouchableOpacity
            style={[s.mainBtn, exporting && { opacity: 0.6 }]}
            onPress={handleExportIcs}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={s.mainBtnText}>{t('vgp.exportIcs')}</Text>
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
                <Text style={s.outlineBtnEpiText}>{t('vgp.addEpi')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.outlineBtn}
                onPress={() => {
                  setAddKind('general');
                  setAddOpen(true);
                }}
              >
                <Text style={s.outlineBtnText}>{t('vgp.addEquip')}</Text>
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 + bottomSafePad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>📅</Text>
            <Text style={s.emptyText}>{t('vgp.emptyTitle')}</Text>
            {editOk && (
              <Text style={s.emptyHint}>
                {t('vgp.emptyHint')}
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
        title={addKind === 'epi' ? t('vgp.pick.title.epi') : t('vgp.pick.title.gen')}
      >
        <Text style={s.modalHint}>
          {addKind === 'epi' ? t('vgp.pick.hint.epi') : t('vgp.pick.hint.gen')}
        </Text>
        <TextInput
          style={s.search}
          placeholder={t('vgp.pick.searchPh')}
          placeholderTextColor={Colors.textMuted}
          value={pickSearch}
          onChangeText={setPickSearch}
        />
        <View style={s.pickList}>
          {pickCandidates.slice(0, 80).length === 0 ? (
            <Text style={s.emptyPick}>{t('vgp.pick.none')}</Text>
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
              label={t('vgp.edit.controlType')}
              value={libelle}
              onChangeText={setLibelle}
              placeholder={isEpi ? t('vgp.edit.controlTypePhEpi') : t('vgp.edit.controlTypePhGen')}
            />
            <Input
              label={t('vgp.edit.periodDays')}
              value={periodicite}
              onChangeText={setPeriodicite}
              keyboardType="numeric"
              placeholder={t('vgp.edit.periodPh')}
            />
            <DateField label={t('vgp.edit.lastVisit')} value={derniere} onChange={setDerniere} allowClear />
            <Text style={s.modalHint}>{t('vgp.edit.nextHint')}</Text>
            <Card style={{ marginTop: 6, marginBottom: 10 }}>
              <Text style={s.sectionTitle}>{t('vgp.pdf.section')}</Text>
              {!!(editMat.notice_pdf_local || editMat.notice_pdf_url) ? (
                <Text style={s.modalHint}>{t('vgp.pdf.hasHint')}</Text>
              ) : (
                <Text style={s.modalHint}>{t('vgp.pdf.noneHint')}</Text>
              )}
              <View style={s.rowBtns}>
                {!!(editMat.notice_pdf_local || editMat.notice_pdf_url) && (
                  <TouchableOpacity style={s.smallBtn} onPress={() => void openControlReportPdf(editMat)}>
                    <Text style={s.smallBtnText}>{t('vgp.pdf.open')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.smallBtn} onPress={() => void attachControlReportPdf(editMat)}>
                  <Text style={s.smallBtnText}>
                    {editMat.notice_pdf_local || editMat.notice_pdf_url ? t('vgp.pdf.replace') : t('vgp.pdf.attach')}
                  </Text>
                </TouchableOpacity>
                {!!(editMat.notice_pdf_local || editMat.notice_pdf_url) && (
                  <TouchableOpacity style={s.smallBtnOutline} onPress={() => removeControlReportPdf(editMat)}>
                    <Text style={s.smallBtnOutlineText}>{t('vgp.pdf.removeShort')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
            <FormButtons onCancel={closeEdit} onSave={saveEdit} loading={saving} />
            {editOk && (
              <TouchableOpacity style={s.dangerBtn} onPress={retirerVgp}>
                <Text style={s.dangerBtnText}>{t('vgp.removeFromTracking')}</Text>
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
  subReport: { color: Colors.green, fontSize: 12, marginTop: 5, fontWeight: '700' },
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
