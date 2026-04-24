// src/screens/AlertesScreen.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, RefreshControl, TouchableOpacity, Alert, Linking, TextInput
} from 'react-native';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import {
  getAlertesEmail,
  getConsommablesAlerte,
  getPrets,
  getMaterielsPourMaintenanceAlertes,
  getMaterielsPourVgpAlertes,
} from '../db/database';
import { loadMailRecipientAlerteIds, loadNotificationPrefs } from '../lib/notificationPrefs';
import { loadUserProfile, formatMailSignature } from '../lib/userProfileStorage';
import { Consommable, Pret, Materiel } from '../types';
import { BottomModal, BtnPrimary, BtnSecondary, Card, TabScreenSafeArea } from '../components/UI';
import { vgpProchaineEcheanceIso, isVgpEnRetard, isVgpEpi } from '../lib/vgp';
import { maybeSendAutoAlertEmailsIfNeeded } from '../lib/autoAlertEmails';
import {
  openConsoFicheFromAlerte,
  openMaterielFicheFromAlerte,
  openPretFicheFromAlerte,
} from '../navigation/openFicheFromAlerte';

type AlerteRow =
  | { type: 'pret'; data: Pret }
  | { type: 'conso'; data: Consommable }
  | { type: 'maint'; data: Materiel }
  | { type: 'vgp'; data: Materiel };

type AlerteSection = { title: string; data: AlerteRow[] };
type AchatDraft = { id: string; selected: boolean; quantity: string };

function formatDateCourt(raw: string | undefined): string {
  if (!raw) return '';
  const d = raw.includes('T') ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
  if (!isValid(d)) return raw;
  return format(d, 'd MMM yyyy', { locale: fr });
}

export default function AlertesScreen() {
  const navigation = useNavigation<any>();
  const [consoBas, setConsoBas] = useState<Consommable[]>([]);
  const [pretsRetard, setPretsRetard] = useState<Pret[]>([]);
  const [maint, setMaint] = useState<Materiel[]>([]);
  const [vgp, setVgp] = useState<Materiel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [destEmail, setDestEmail] = useState('');
  const [achatDrafts, setAchatDrafts] = useState<AchatDraft[]>([]);
  const [mailSeuilEnabled, setMailSeuilEnabled] = useState(true);

  const load = useCallback(async () => {
    const [conso, prets, matMaint, vgpList, prefs] = await Promise.all([
      getConsommablesAlerte(),
      getPrets(),
      getMaterielsPourMaintenanceAlertes(30),
      getMaterielsPourVgpAlertes(30),
      loadNotificationPrefs(),
    ]);
    setMailSeuilEnabled(prefs.mailSuggestionSeuil);
    setConsoBas(conso);
    setMaint(matMaint);
    setVgp(vgpList);
    const today = new Date().toISOString().split('T')[0];
    setPretsRetard(
      prets.filter(
        p =>
          (p.statut === 'en cours' || p.statut === 'en retard') &&
          p.retour_prevu &&
          p.retour_prevu < today
      )
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      void maybeSendAutoAlertEmailsIfNeeded();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const recommendedQty = useCallback((c: Consommable) => {
    const target = Math.max(c.seuil_minimum * 2, c.seuil_minimum + 1);
    return Math.max(1, Math.ceil(target - c.stock_actuel));
  }, []);

  const openOrderModal = useCallback(async () => {
    const [recipIds, alertList] = await Promise.all([loadMailRecipientAlerteIds(), getAlertesEmail()]);
    const pick = recipIds.length ? alertList.filter(a => recipIds.includes(a.id)) : alertList;
    const emails = pick.map(a => a.email.trim()).filter(Boolean);
    setDestEmail(emails.join(', '));
    const rows: AchatDraft[] = consoBas.map(c => ({
      id: c.id,
      selected: true,
      quantity: String(recommendedQty(c)),
    }));
    setAchatDrafts(rows);
    setOrderModalOpen(true);
  }, [consoBas, recommendedQty]);

  const updateDraft = useCallback((id: string, patch: Partial<AchatDraft>) => {
    setAchatDrafts(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const composePurchaseMail = useCallback(async () => {
    const selected = consoBas
      .map(c => {
        const draft = achatDrafts.find(r => r.id === c.id);
        const qty = Math.max(0, Number(draft?.quantity ?? 0) || 0);
        return { conso: c, selected: !!draft?.selected, qty };
      })
      .filter(row => row.selected && row.qty > 0);

    if (selected.length === 0) {
      Alert.alert('Aucune ligne', 'Sélectionne au moins un article avec une quantité > 0.');
      return;
    }

    const profile = await loadUserProfile();
    const sig = formatMailSignature(profile);
    const placeholderSig =
      '[Votre nom]\n[Votre fonction]\n[Votre entreprise]\n[Vos coordonnées]';
    const bulletLines = selected.map(({ conso, qty }) => {
      const ref = conso.reference?.trim() ? ` — ref. ${conso.reference.trim()}` : '';
      return `- ${conso.nom}${ref} — ${qty} ${conso.unite}`;
    });

    const subject = '[Stage Stock] Demande de devis — fournitures';
    const body = [
      'Bonjour,',
      '',
      'Je souhaiterais avoir un devis pour l’achat des fournitures suivantes :',
      '',
      ...bulletLines,
      '',
      'Je vous serais reconnaissant(e) de bien vouloir m’indiquer les prix, les délais de livraison ainsi que les éventuelles conditions commerciales associées.',
      '',
      'Je vous remercie par avance pour votre retour.',
      '',
      'Cordialement,',
      '',
      sig.trim() ? sig : placeholderSig,
    ].join('\n');

    const to = destEmail.trim();
    if (!to) {
      Alert.alert(
        'Destinataire',
        'Indiquez au moins une adresse (séparées par des virgules si besoin) ou enregistrez des contacts dans Paramètres.'
      );
      return;
    }
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
      Alert.alert('Aucun client mail', 'Impossible d’ouvrir une application e-mail sur cet appareil.');
      return;
    }
    await Linking.openURL(url);
    setOrderModalOpen(false);
  }, [achatDrafts, consoBas, destEmail]);

  const vgpEpi = useMemo(() => vgp.filter(isVgpEpi), [vgp]);
  const vgpAutres = useMemo(() => vgp.filter(m => !isVgpEpi(m)), [vgp]);
  const openMaterielForEdit = useCallback(
    (materielId: string) => {
      openMaterielFicheFromAlerte(navigation, materielId, 'stock');
    },
    [navigation]
  );
  const openPretForEdit = useCallback(
    (pretId: string) => {
      openPretFicheFromAlerte(navigation, pretId);
    },
    [navigation]
  );
  const openConsoForEdit = useCallback(
    (consoId: string) => {
      openConsoFicheFromAlerte(navigation, consoId);
    },
    [navigation]
  );

  const total = consoBas.length + pretsRetard.length + maint.length + vgp.length;

  const sections = useMemo(() => {
    const out: AlerteSection[] = [];
    if (pretsRetard.length) {
      out.push({
        title: 'PRÊTS EN RETARD',
        data: pretsRetard.map(p => ({ type: 'pret' as const, data: p })),
      });
    }
    if (consoBas.length) {
      out.push({
        title: 'STOCKS CONSOMMABLES FAIBLES',
        data: consoBas.map(c => ({ type: 'conso' as const, data: c })),
      });
    }
    if (maint.length) {
      out.push({
        title: 'MAINTENANCE / VALIDITÉ (30 J)',
        data: maint.map(m => ({ type: 'maint' as const, data: m })),
      });
    }
    if (vgpEpi.length) {
      out.push({
        title: 'VGP — EPI (30 J)',
        data: vgpEpi.map(m => ({ type: 'vgp' as const, data: m })),
      });
    }
    if (vgpAutres.length) {
      out.push({
        title: 'VGP — AUTRES ÉQUIPEMENTS (30 J)',
        data: vgpAutres.map(m => ({ type: 'vgp' as const, data: m })),
      });
    }
    return out;
  }, [pretsRetard, consoBas, maint, vgpEpi, vgpAutres]);

  return (
    <TabScreenSafeArea style={s.container}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
        <View style={s.header}>
          <Text style={{ fontSize: 22, color: Colors.green }}>🔔</Text>
          <Text style={s.title}>Alertes</Text>
          {total > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{total}</Text>
            </View>
          )}
        </View>
        {consoBas.length > 0 && mailSeuilEnabled && (
          <TouchableOpacity style={s.purchaseBtn} onPress={() => void openOrderModal()} activeOpacity={0.8}>
            <Text style={s.purchaseBtnText}>Préparer un e-mail d'achat ({consoBas.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      {total === 0 ? (
        <View style={[s.empty, { paddingHorizontal: 20 }]}>
          <Text style={{ fontSize: 48 }}>✅</Text>
          <Text style={{ color: Colors.textMuted, marginTop: 12, fontSize: 16 }}>Aucune alerte</Text>
          <Text style={{ color: Colors.textMuted, marginTop: 4, fontSize: 13 }}>
            Prêts à jour, stocks, maintenance et VGP OK
          </Text>
        </View>
      ) : (
        <SectionList<AlerteRow, AlerteSection>
          sections={sections}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
          keyExtractor={(item: AlerteRow) => `${item.type}-${item.data.id}`}
          renderSectionHeader={({ section }: { section: AlerteSection }) => (
            <Text style={s.sectionLabel}>
              {section.title.startsWith('PRÊTS') ? '⚠️ ' : section.title.startsWith('MAINT') ? '🔧 ' : section.title.startsWith('VGP') ? '📅 ' : '📦 '}
              {section.title}
              {(section.title.startsWith('STOCKS') || section.title.startsWith('MAINT') || section.title.startsWith('VGP')) ? ` (${section.data.length})` : ''}
            </Text>
          )}
          renderItem={({ item }: { item: AlerteRow }) => {
            if (item.type === 'vgp') {
              const m = item.data;
              const proch = vgpProchaineEcheanceIso(m);
              const retard = isVgpEnRetard(m);
              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openMaterielFicheFromAlerte(navigation, m.id, 'vgp')}
                >
                  <Card style={[s.alertCard, { borderColor: retard ? Colors.red : Colors.yellow }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 20 }}>📅</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.alertName}>
                          {m.nom}
                          {isVgpEpi(m) ? ' · EPI' : ''}
                        </Text>
                        <Text style={s.alertSub}>
                          {m.vgp_libelle ? `${m.vgp_libelle} · ` : ''}
                          {proch ? `Échéance : ${formatDateCourt(proch)}` : 'À compléter ou visite à planifier'}
                          {m.vgp_periodicite_jours ? ` · tous les ${m.vgp_periodicite_jours} j` : ''}
                        </Text>
                      </View>
                      {retard && (
                        <View style={[s.pill, { backgroundColor: Colors.red }]}>
                          <Text style={s.pillText}>Due</Text>
                        </View>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            }
            if (item.type === 'maint') {
              const m = item.data;
              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openMaterielForEdit(m.id)}
                >
                  <Card style={[s.alertCard, { borderColor: Colors.yellow }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 20 }}>🔧</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.alertName}>{m.nom}</Text>
                        <Text style={s.alertSub}>
                          {m.date_validite ? `Validité : ${formatDateCourt(m.date_validite)} · ` : ''}
                          {m.prochain_controle ? `Contrôle : ${formatDateCourt(m.prochain_controle)}` : ''}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            }
            if (item.type === 'pret') {
              const pret = item.data;
              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openPretForEdit(pret.id)}
                >
                  <Card style={s.alertCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 20 }}>⚠️</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.alertName}>{pret.emprunteur}</Text>
                        <Text style={s.alertSub}>
                          Retour prévu : {formatDateCourt(pret.retour_prevu)}
                          {pret.organisation ? ` · ${pret.organisation}` : ''}
                        </Text>
                      </View>
                      <View style={[s.pill, { backgroundColor: Colors.red }]}>
                        <Text style={s.pillText}>En retard</Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            }

            const conso = item.data;
            const isEmpty = conso.stock_actuel === 0;
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openConsoForEdit(conso.id)}
              >
                <Card style={s.alertCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 20 }}>⚠️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.alertName}>{conso.nom}</Text>
                      <Text style={s.alertSub}>{conso.reference ?? ' '}</Text>
                    </View>
                    <View style={[s.pill, { backgroundColor: isEmpty ? Colors.red : Colors.yellow }]}>
                      <Text style={s.pillText}>{conso.stock_actuel} / {conso.seuil_minimum}</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}
      <BottomModal
        visible={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        title="Achat consommables (seuil bas)"
      >
        <Text style={s.modalHint}>
          Sélectionne les articles à recommander et ajuste les quantités avant d’ouvrir l’e-mail.
        </Text>
        <Text style={s.modalLabel}>Destinataire e-mail (optionnel)</Text>
        <TextInput
          style={s.mailInput}
          value={destEmail}
          onChangeText={setDestEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="fournisseur@exemple.com"
          placeholderTextColor={Colors.textMuted}
        />
        <View style={s.bulkRow}>
          <TouchableOpacity
            style={s.bulkBtn}
            onPress={() => setAchatDrafts(prev => prev.map(r => ({ ...r, selected: true })))}
          >
            <Text style={s.bulkBtnText}>Tout sélectionner</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.bulkBtn}
            onPress={() => setAchatDrafts(prev => prev.map(r => ({ ...r, selected: false })))}
          >
            <Text style={s.bulkBtnText}>Tout désélectionner</Text>
          </TouchableOpacity>
        </View>
        {consoBas.map(c => {
          const draft = achatDrafts.find(r => r.id === c.id);
          const selected = !!draft?.selected;
          return (
            <View key={c.id} style={[s.lineRow, selected && s.lineRowActive]}>
              <TouchableOpacity
                style={s.checkbox}
                onPress={() => updateDraft(c.id, { selected: !selected })}
              >
                <Text style={s.checkboxText}>{selected ? '✓' : ''}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.lineTitle}>{c.nom}</Text>
                <Text style={s.lineSub}>
                  Stock {c.stock_actuel} / Seuil {c.seuil_minimum}
                  {c.fournisseur ? ` · ${c.fournisseur}` : ''}
                </Text>
              </View>
              <TextInput
                style={s.qtyInput}
                value={draft?.quantity ?? String(recommendedQty(c))}
                keyboardType="number-pad"
                onChangeText={(t) => updateDraft(c.id, { quantity: t.replace(/[^0-9]/g, '') })}
              />
            </View>
          );
        })}
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <BtnSecondary label="Annuler" onPress={() => setOrderModalOpen(false)} />
          <BtnPrimary label="Ouvrir l'e-mail" onPress={composePurchaseMail} />
        </View>
      </BottomModal>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  purchaseBtn: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  purchaseBtnText: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  badge: {
    backgroundColor: Colors.red, borderRadius: 12,
    minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  sectionLabel: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginBottom: 10,
  },
  alertCard: { borderWidth: 1, borderColor: Colors.red },
  alertName: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  alertSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 48 },
  modalHint: { color: Colors.textSecondary, marginBottom: 10, fontSize: 13 },
  modalLabel: { color: Colors.textPrimary, marginBottom: 6, fontWeight: '600' },
  mailInput: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.bgInputBorder,
    borderRadius: 10,
    color: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  bulkRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  bulkBtn: {
    flex: 1,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  bulkBtnText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  lineRowActive: { backgroundColor: Colors.bgCardAlt },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxText: { color: Colors.white, fontWeight: '700' },
  lineTitle: { color: Colors.white, fontWeight: '600' },
  lineSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  qtyInput: {
    width: 64,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.bgInputBorder,
    borderRadius: 8,
    color: Colors.white,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontWeight: '700',
  },
});
