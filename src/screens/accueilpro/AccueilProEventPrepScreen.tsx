import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  AccueilProChip,
  AccueilProFormCard,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import {
  getApEvent,
  generateApId,
  listApEventPersonnel,
  listApOrganizationDocumentsByEvent,
  saveApEventPersonnel,
} from '../../db/accueilProDb';
import { getApCapiDossierRefBySpectacleRefId } from '../../db/capiAccueilProRefDb';
import {
  budgetLineTotal,
  listPersonnelBudgetLines,
  listShoppingListItems,
  mergeShoppingListFromProposal,
  replacePersonnelBudgetFromProposal,
  savePersonnelBudgetLine,
  saveShoppingListItem,
  deleteShoppingListItem,
} from '../../db/accueilProPrepDb';
import { postAccueilProAiPrep } from '../../lib/accueilProAiPrepApi';
import type { ApPersonnelBudgetLine, ApShoppingListItem } from '../../types/accueilPro';

type PrepTab = 'budget' | 'shopping';

export default function AccueilProEventPrepScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const eventId = route.params?.eventId as string;

  const [tab, setTab] = useState<PrepTab>('budget');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [summary, setSummary] = useState('');
  const [caveats, setCaveats] = useState<string[]>([]);
  const [providerLabel, setProviderLabel] = useState('');
  const [budget, setBudget] = useState<ApPersonnelBudgetLine[]>([]);
  const [shopping, setShopping] = useState<ApShoppingListItem[]>([]);
  const [pendingStaff, setPendingStaff] = useState<
    Array<{ role: string; quantity: number; mission?: string }>
  >([]);
  const [eventName, setEventName] = useState('');
  const [shopDraft, setShopDraft] = useState('');
  const [showShopAdd, setShowShopAdd] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const ev = await getApEvent(eventId);
      setEventName(ev?.name ?? '');
      setBudget(await listPersonnelBudgetLines(eventId));
      setShopping(await listShoppingListItems(eventId));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const budgetTotal = useMemo(
    () =>
      budget
        .filter(b => b.status !== 'rejected')
        .reduce((acc, line) => acc + budgetLineTotal(line), 0),
    [budget]
  );

  const shoppingTodo = useMemo(() => shopping.filter(s => !s.checked).length, [shopping]);

  const runAi = async () => {
    setAnalyzing(true);
    try {
      const ev = await getApEvent(eventId);
      if (!ev) {
        Alert.alert(t('accueilpro.prep.errTitle'), t('accueilpro.prep.errNoEvent'));
        return;
      }
      const dossier = ev.capi_spectacle_ref_id
        ? await getApCapiDossierRefBySpectacleRefId(ev.capi_spectacle_ref_id)
        : null;
      const docs = ev.organization_id
        ? await listApOrganizationDocumentsByEvent(eventId)
        : [];
      const res = await postAccueilProAiPrep({
        event_name: ev.name,
        event_dates: [ev.date_debut, ev.date_fin].filter(Boolean).join(' → '),
        participants: ev.participants,
        personnel_accueil: dossier?.personnelAccueil ?? null,
        equipe: (dossier?.equipe ?? []).map(m => ({
          nom: m.nom,
          role: m.role,
          structure: m.structure,
        })),
        planning_personnel: (dossier?.planningPersonnel ?? []).map(p => ({
          nom: p.nom,
          role: p.role,
          creneaux: p.creneaux,
        })),
        repas: (dossier?.repas ?? []).map(r => ({
          creneau: r.creneau,
          lieu: r.lieu,
          nbPersonnes: r.nbPersonnes,
          notes: r.notes,
        })),
        besoins_technique: (dossier?.besoinsTechnique ?? []).map(b => ({
          pole: b.pole,
          label: b.label,
          value: b.value,
        })),
        document_titles: docs.map(d => d.title),
        notes: dossier?.notesAccueil ?? ev.description ?? null,
      });
      if (!res.ok) {
        Alert.alert(t('accueilpro.prep.errTitle'), res.error);
        return;
      }
      const p = res.proposal;
      setSummary(p.summary);
      setCaveats(p.caveats ?? []);
      setProviderLabel(`${p.provider}${p.model ? ` · ${p.model}` : ''}`);
      setPendingStaff(p.staff_needs ?? []);
      await replacePersonnelBudgetFromProposal(eventId, p.budget_lines ?? []);
      const added = await mergeShoppingListFromProposal(eventId, p.shopping_list ?? []);
      await reload();
      Alert.alert(
        t('accueilpro.prep.readyTitle'),
        t('accueilpro.prep.readyBody', {
          staff: p.staff_needs?.length ?? 0,
          budget: p.budget_lines?.length ?? 0,
          shop: added,
        })
      );
    } catch (e) {
      Alert.alert(t('accueilpro.prep.errTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  const acceptBudgetLine = async (line: ApPersonnelBudgetLine) => {
    await savePersonnelBudgetLine({ ...line, status: 'accepted' });
    await reload();
  };

  const rejectBudgetLine = async (line: ApPersonnelBudgetLine) => {
    await savePersonnelBudgetLine({ ...line, status: 'rejected' });
    await reload();
  };

  const acceptAllBudget = async () => {
    for (const line of budget.filter(b => b.status === 'proposed')) {
      await savePersonnelBudgetLine({ ...line, status: 'accepted' });
    }
    await reload();
  };

  const applyStaffToEvent = async () => {
    if (!pendingStaff.length) {
      Alert.alert(t('accueilpro.prep.errTitle'), t('accueilpro.prep.noStaffPending'));
      return;
    }
    const existing = await listApEventPersonnel(eventId);
    const names = new Set(existing.map(e => e.name.trim().toLowerCase()));
    let added = 0;
    for (const s of pendingStaff) {
      for (let i = 0; i < Math.max(1, s.quantity); i++) {
        const name =
          s.quantity > 1 ? `${s.role} ${i + 1}` : s.role;
        if (names.has(name.toLowerCase())) continue;
        await saveApEventPersonnel({
          id: generateApId(),
          event_id: eventId,
          source: 'adhoc',
          name,
          day_role: s.role,
          day_mission: s.mission ?? null,
          phone: null,
          email: null,
          source_personnel_id: null,
        });
        names.add(name.toLowerCase());
        added += 1;
      }
    }
    setPendingStaff([]);
    Alert.alert(t('accueilpro.prep.staffAppliedTitle'), t('accueilpro.prep.staffAppliedBody', { count: added }));
  };

  const toggleShop = async (item: ApShoppingListItem) => {
    await saveShoppingListItem({ ...item, checked: !item.checked });
    await reload();
  };

  const persistShopLabel = async (raw: string) => {
    const label = raw.trim();
    if (!label) return;
    await saveShoppingListItem({
      id: generateApId(),
      event_id: eventId,
      label,
      quantity: 1,
      unit: 'u',
      category: 'autre',
      notes: null,
      checked: false,
      source: 'manual',
    });
    setShopDraft('');
    setShowShopAdd(false);
    await reload();
  };

  const addManualShop = () => {
    if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
      Alert.prompt(t('accueilpro.prep.addShopTitle'), t('accueilpro.prep.addShopBody'), text => {
        void persistShopLabel(text ?? '');
      });
      return;
    }
    setShowShopAdd(true);
  };

  const catLabel = (c: string) => {
    if (c === 'catering') return t('accueilpro.prep.catCatering');
    if (c === 'fournitures') return t('accueilpro.prep.catSupplies');
    return t('accueilpro.prep.catOther');
  };

  return (
    <AccueilProScreenLayout
      headerTitle={t('accueilpro.prep.title')}
      headerSubtitle={eventName || t('accueilpro.prep.subtitle')}
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      refreshing={loading}
      onRefresh={() => void reload()}
    >
      <Text style={apStyles.hint}>{t('accueilpro.prep.lead')}</Text>

      <AccueilProPrimaryButton
        label={t('accueilpro.prep.analyzeCta')}
        onPress={() => void runAi()}
        loading={analyzing}
        style={{ marginBottom: Spacing.md }}
      />

      {summary ? (
        <AccueilProFormCard>
          <Text style={apStyles.sectionTitle}>{t('accueilpro.prep.summaryTitle')}</Text>
          <Text style={[apStyles.rowMeta, { marginBottom: 8 }]}>{summary}</Text>
          {providerLabel ? (
            <Text style={apStyles.hint}>{t('accueilpro.prep.provider', { provider: providerLabel })}</Text>
          ) : null}
          {caveats.map((c, i) => (
            <Text key={`cav-${i}`} style={[apStyles.hint, { marginTop: 4 }]}>
              • {c}
            </Text>
          ))}
        </AccueilProFormCard>
      ) : null}

      {pendingStaff.length > 0 ? (
        <AccueilProFormCard>
          <Text style={apStyles.sectionTitle}>{t('accueilpro.prep.staffTitle')}</Text>
          <Text style={apStyles.hint}>{t('accueilpro.prep.staffHint')}</Text>
          {pendingStaff.map((s, i) => (
            <View key={`st-${i}`} style={{ marginTop: 8 }}>
              <Text style={apStyles.rowTitle}>
                {s.quantity}× {s.role}
              </Text>
              {s.mission ? <Text style={apStyles.rowMeta}>{s.mission}</Text> : null}
            </View>
          ))}
          <AccueilProPrimaryButton
            label={t('accueilpro.prep.staffApplyCta')}
            onPress={() => void applyStaffToEvent()}
            style={{ marginTop: Spacing.md }}
          />
        </AccueilProFormCard>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.md }}>
        <AccueilProChip
          label={`${t('accueilpro.prep.tabBudget')} (${budgetTotal.toFixed(0)} €)`}
          selected={tab === 'budget'}
          onPress={() => setTab('budget')}
        />
        <AccueilProChip
          label={`${t('accueilpro.prep.tabShopping')} (${shoppingTodo})`}
          selected={tab === 'shopping'}
          onPress={() => setTab('shopping')}
        />
      </View>

      {tab === 'budget' ? (
        <AccueilProFormCard>
          <View style={apStyles.sectionHeader}>
            <Text style={apStyles.sectionTitle}>{t('accueilpro.prep.budgetTitle')}</Text>
            {budget.some(b => b.status === 'proposed') ? (
              <TouchableOpacity onPress={() => void acceptAllBudget()}>
                <Text style={apStyles.sectionLink}>{t('accueilpro.prep.acceptAll')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={apStyles.hint}>{t('accueilpro.prep.budgetHint')}</Text>
          {budget.length === 0 ? (
            <Text style={apStyles.empty}>{t('accueilpro.prep.budgetEmpty')}</Text>
          ) : (
            budget.map(line => {
              const total = budgetLineTotal(line);
              return (
                <View
                  key={line.id}
                  style={{
                    borderWidth: 1,
                    borderColor: AccueilProColors.borderSubtle,
                    borderRadius: 10,
                    padding: 12,
                    marginTop: 10,
                    opacity: line.status === 'rejected' ? 0.45 : 1,
                  }}
                >
                  <Text style={apStyles.rowTitle}>
                    {line.quantity}× {line.role}
                  </Text>
                  <Text style={apStyles.rowMeta}>
                    {line.hours} h · {line.rate_eur} €/h · {total.toFixed(2)} € · {line.status}
                  </Text>
                  {line.notes ? <Text style={apStyles.hint}>{line.notes}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <Text style={apStyles.hint}>€/h</Text>
                    <TextInput
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: AccueilProColors.borderSubtle,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        color: AccueilProColors.textPrimary,
                      }}
                      keyboardType="decimal-pad"
                      defaultValue={String(line.rate_eur)}
                      onEndEditing={e => {
                        const v = parseFloat(e.nativeEvent.text.replace(',', '.'));
                        if (!Number.isFinite(v) || v < 0) return;
                        void savePersonnelBudgetLine({ ...line, rate_eur: v }).then(reload);
                      }}
                    />
                  </View>
                  {line.status === 'proposed' ? (
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                      <TouchableOpacity onPress={() => void acceptBudgetLine(line)}>
                        <Text style={apStyles.sectionLink}>{t('accueilpro.prep.accept')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => void rejectBudgetLine(line)}>
                        <Text style={apStyles.actionNo}>{t('accueilpro.prep.reject')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
          <Text style={[apStyles.rowTitle, { marginTop: 14 }]}>
            {t('accueilpro.prep.budgetTotal', { total: budgetTotal.toFixed(2) })}
          </Text>
        </AccueilProFormCard>
      ) : (
        <AccueilProFormCard>
          <View style={apStyles.sectionHeader}>
            <Text style={apStyles.sectionTitle}>{t('accueilpro.prep.shoppingTitle')}</Text>
            <TouchableOpacity onPress={addManualShop}>
              <Text style={apStyles.sectionLink}>+ {t('accueilpro.prep.addShop')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={apStyles.hint}>{t('accueilpro.prep.shoppingHint')}</Text>
          {showShopAdd ? (
            <View style={{ marginTop: 10, marginBottom: 6 }}>
              <Text style={apStyles.hint}>{t('accueilpro.prep.addShopBody')}</Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: AccueilProColors.borderSubtle,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  marginTop: 6,
                  color: AccueilProColors.textPrimary,
                }}
                placeholder={t('accueilpro.prep.addShopPlaceholder')}
                placeholderTextColor={AccueilProColors.textMuted}
                value={shopDraft}
                onChangeText={setShopDraft}
                autoFocus
                onSubmitEditing={() => void persistShopLabel(shopDraft)}
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <TouchableOpacity onPress={() => void persistShopLabel(shopDraft)}>
                  <Text style={apStyles.sectionLink}>{t('accueilpro.prep.addShop')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowShopAdd(false);
                    setShopDraft('');
                  }}
                >
                  <Text style={apStyles.actionNo}>{t('accueilpro.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {shopping.length === 0 ? (
            <Text style={apStyles.empty}>{t('accueilpro.prep.shoppingEmpty')}</Text>
          ) : (
            shopping.map(item => (
              <TouchableOpacity
                key={item.id}
                onPress={() => void toggleShop(item)}
                onLongPress={() => {
                  Alert.alert(item.label, undefined, [
                    { text: t('accueilpro.cancel'), style: 'cancel' },
                    {
                      text: t('accueilpro.documents.deleteCta'),
                      style: 'destructive',
                      onPress: () => void deleteShoppingListItem(item.id).then(reload),
                    },
                  ]);
                }}
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'flex-start',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: AccueilProColors.borderSubtle,
                }}
              >
                <Text style={{ fontSize: 18 }}>{item.checked ? '☑' : '☐'}</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      apStyles.rowTitle,
                      item.checked ? { textDecorationLine: 'line-through', opacity: 0.6 } : null,
                    ]}
                  >
                    {item.quantity} {item.unit || 'u'} · {item.label}
                  </Text>
                  <Text style={apStyles.rowMeta}>
                    {catLabel(item.category)}
                    {item.notes ? ` · ${item.notes}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </AccueilProFormCard>
      )}

      <AccueilProPrimaryButton
        label={t('accueilpro.eventTeam.manage')}
        onPress={() => navigation.navigate('AccueilProEventPersonnel', { eventId })}
        style={{ marginTop: Spacing.md, marginBottom: Spacing.xl }}
      />
    </AccueilProScreenLayout>
  );
}
