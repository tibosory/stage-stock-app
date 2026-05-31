import React, { useCallback, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  AccueilProEmpty,
  AccueilProLinkButton,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  AccueilProSectionCard,
  AccueilProStatusBadge,
  AccueilProTypeBadge,
  AccueilProColors,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { saveApDayNote } from '../../db/accueilProDb';
import { formatDayPlanTimeRange } from '../../lib/accueilProDayPlanHelpers';
import {
  buildFeuilleRouteSnapshot,
  type FeuilleEventSynthesis,
  type FeuilleRouteSnapshot,
} from '../../lib/accueilProFeuilleRouteBuilder';
import { shiftIsoDate } from '../../lib/accueilProFeuilleHelpers';
import { exportAccueilProFeuilleRoutePdf } from '../../lib/accueilProFeuilleRoutePdf';
import { todayIsoDate } from './accueilProScreenCommon';

function EventSynthesisCard({
  block,
  t,
  spaceNames,
}: {
  block: FeuilleEventSynthesis;
  t: (key: string) => string;
  spaceNames: Record<string, string>;
}) {
  const ev = block.event;
  const dates =
    ev.date_fin && ev.date_fin !== ev.date_debut ?
      `${ev.date_debut} → ${ev.date_fin}`
    : ev.date_debut;

  return (
    <AccueilProSectionCard title={ev.name}>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <AccueilProStatusBadge status={ev.status} />
        <AccueilProTypeBadge type={ev.type} />
        <Text style={{ fontWeight: '700', color: AccueilProColors.gold, marginLeft: 'auto' }}>
          {ev.heure_debut ?? '—'}
          {ev.heure_fin ? ` → ${ev.heure_fin}` : ''}
        </Text>
      </View>

      {[
        [t('accueilpro.feuille.organization'), block.organizationName],
        [t('accueilpro.feuille.venue'), block.venueName],
        [t('accueilpro.feuille.spaces'), block.spacesLabel],
        [t('accueilpro.feuille.dates'), dates],
        [
          t('accueilpro.feuille.participants'),
          ev.participants != null ? String(ev.participants) : '—',
        ],
      ].map(([label, value]) => (
        <Text key={String(label)} style={{ fontSize: 13, marginBottom: 4, color: AccueilProColors.textSecondary }}>
          <Text style={{ fontWeight: '600', color: AccueilProColors.textPrimary }}>{label} : </Text>
          {value}
        </Text>
      ))}

      {ev.description?.trim() ?
        <View
          style={{
            backgroundColor: AccueilProColors.cream,
            borderRadius: 8,
            padding: 10,
            marginTop: 6,
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{t('accueilpro.feuille.description')}</Text>
          <Text style={{ fontSize: 13, color: AccueilProColors.textSecondary }}>{ev.description.trim()}</Text>
        </View>
      : null}

      <Text style={{ fontWeight: '700', fontSize: 13, marginTop: 10, marginBottom: 6 }}>
        {t('accueilpro.feuille.teamDay')}
      </Text>
      {block.personnel.length === 0 ?
        <Text style={{ fontSize: 12, color: AccueilProColors.textMuted, marginBottom: 8 }}>
          {t('accueilpro.feuille.noTeam')}
        </Text>
      : block.personnel.map(p => (
          <View
            key={`${p.name}-${p.role}`}
            style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: AccueilProColors.borderSubtle }}
          >
            <Text style={{ fontWeight: '600' }}>{p.name}</Text>
            {p.role ?
              <Text style={{ fontSize: 12, color: AccueilProColors.gold, marginTop: 2 }}>{p.role}</Text>
            : null}
            {(p.phone || p.email) ?
              <Text style={{ fontSize: 12, color: AccueilProColors.textMuted, marginTop: 2 }}>
                {[p.phone, p.email].filter(Boolean).join(' · ')}
              </Text>
            : null}
          </View>
        ))}

      {block.agenda.length > 0 ?
        <>
          <Text style={{ fontWeight: '700', fontSize: 13, marginTop: 12, marginBottom: 6 }}>
            {t('accueilpro.feuille.eventAgenda')}
          </Text>
          {block.agenda.map(item => (
            <View
              key={item.id}
              style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: AccueilProColors.borderSubtle }}
            >
              <Text style={{ fontWeight: '700', color: AccueilProColors.gold, fontSize: 12 }}>
                {formatDayPlanTimeRange(item)}
              </Text>
              <Text style={{ fontWeight: '600', marginTop: 2 }}>{item.title}</Text>
              <Text style={{ fontSize: 12, color: AccueilProColors.textMuted, marginTop: 2 }}>
                {item.assignee_name ?? '—'} · {(item.space_id && spaceNames[item.space_id]) || '—'}
              </Text>
            </View>
          ))}
        </>
      : null}

      {block.conventions.length > 0 ?
        <>
          <Text style={{ fontWeight: '700', fontSize: 13, marginTop: 12, marginBottom: 6 }}>
            {t('accueilpro.nav.conventions')}
          </Text>
          {block.conventions.map(c => (
            <Text key={c.titre} style={{ fontSize: 13, marginBottom: 4 }}>
              {c.titre} — <Text style={{ color: AccueilProColors.textMuted }}>{c.status}</Text>
            </Text>
          ))}
        </>
      : null}

      {block.inspections.length > 0 ?
        <>
          <Text style={{ fontWeight: '700', fontSize: 13, marginTop: 12, marginBottom: 6 }}>
            {t('accueilpro.nav.inspections')}
          </Text>
          {block.inspections.map((insp, idx) => (
            <Text key={`${insp.spaceName}-${insp.type}-${idx}`} style={{ fontSize: 13, marginBottom: 4 }}>
              {insp.spaceName} · EDL {insp.type} — {insp.status}
            </Text>
          ))}
        </>
      : null}
    </AccueilProSectionCard>
  );
}

export default function AccueilProFeuilleRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const [date, setDate] = useState((route.params?.date as string | undefined) ?? todayIsoDate());
  const [note, setNote] = useState('');
  const [snapshot, setSnapshot] = useState<FeuilleRouteSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const data = await buildFeuilleRouteSnapshot(date);
    setSnapshot(data);
    setNote(data.note);
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const eventBlocks = snapshot?.eventBlocks ?? [];
  const dayPlan = snapshot?.dayPlan ?? [];
  const venues = snapshot?.venues ?? [];
  const spaceNames = snapshot?.spaceNames ?? {};
  const dateLabel = snapshot?.dateLabel ?? date;
  const edlCount = eventBlocks.reduce((n, b) => n + b.inspections.length, 0);
  const convCount = eventBlocks.reduce((n, b) => n + b.conventions.length, 0);

  const onExport = async () => {
    if (!snapshot) return;
    setExporting(true);
    try {
      await exportAccueilProFeuilleRoutePdf({ ...snapshot, note });
    } catch (e) {
      Alert.alert(t('accueilpro.feuille.exportError'), e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>🗒</Text>}
      headerTitle={t('accueilpro.feuille.title')}
      headerSubtitle={t('accueilpro.feuille.subtitle')}
      loading={loading}
      footer={<AccueilProPrimaryButton label={t('accueilpro.feuille.export')} onPress={() => void onExport()} loading={exporting} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <TouchableOpacity onPress={() => setDate(d => shiftIsoDate(d, -1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 22, paddingHorizontal: 8 }}>‹</Text>
        </TouchableOpacity>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          style={{
            flex: 1,
            backgroundColor: '#fff',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: AccueilProColors.borderSubtle,
            padding: 12,
          }}
        />
        <TouchableOpacity onPress={() => setDate(d => shiftIsoDate(d, 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 22, paddingHorizontal: 8 }}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ backgroundColor: AccueilProColors.navy, borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, textTransform: 'uppercase' }}>{t('accueilpro.feuille.dayOf')}</Text>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textTransform: 'capitalize', marginTop: 4 }}>{dateLabel}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
          {[
            { v: eventBlocks.length, l: t('accueilpro.feuille.statEvents') },
            { v: venues.length, l: t('accueilpro.feuille.statVenues') },
            { v: snapshot?.venueTeamCount ?? 0, l: t('accueilpro.feuille.statTeam') },
            { v: edlCount, l: 'EDL' },
            { v: convCount, l: t('accueilpro.nav.conventions') },
          ].map(s => (
            <View key={s.l} style={{ alignItems: 'center', minWidth: '18%' }}>
              <Text style={{ color: AccueilProColors.gold, fontSize: 24, fontWeight: '800' }}>{s.v}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{s.l}</Text>
            </View>
          ))}
        </View>
      </View>

      {eventBlocks.length === 0 && dayPlan.length === 0 ?
        <AccueilProEmpty message={t('accueilpro.feuille.empty')} />
      : <>
          {dayPlan.length > 0 ?
            <AccueilProSectionCard
              title={t('accueilpro.dayPlan.schedule')}
              actionLabel={t('accueilpro.edit')}
              onAction={() => navigation.navigate('AccueilProDayPlan', { date })}
            >
              {dayPlan.map(item => (
                <View key={item.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: AccueilProColors.borderSubtle }}>
                  <Text style={{ fontWeight: '700', color: AccueilProColors.gold }}>{formatDayPlanTimeRange(item)}</Text>
                  <Text style={{ fontWeight: '600', marginTop: 2 }}>{item.title}</Text>
                  <Text style={{ fontSize: 12, color: AccueilProColors.textMuted, marginTop: 2 }}>
                    {t('accueilpro.dayPlan.colWho')}: {item.assignee_name ?? '—'} · {t('accueilpro.dayPlan.colWhere')}:{' '}
                    {(item.space_id && spaceNames[item.space_id]) || '—'}
                  </Text>
                </View>
              ))}
            </AccueilProSectionCard>
          : <View style={{ marginBottom: 12 }}>
              <AccueilProLinkButton
                label={t('accueilpro.dayPlan.openDetailed')}
                onPress={() => navigation.navigate('AccueilProDayPlan', { date })}
              />
            </View>}

          {eventBlocks.length > 0 ?
            <>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  color: AccueilProColors.textMuted,
                  marginBottom: 8,
                  letterSpacing: 0.5,
                }}
              >
                {t('accueilpro.feuille.synthesisByEvent')}
              </Text>
              {eventBlocks.map(block => (
                <EventSynthesisCard key={block.event.id} block={block} t={t} spaceNames={spaceNames} />
              ))}
            </>
          : null}

          {venues.length > 0 ?
            <AccueilProSectionCard title={t('accueilpro.feuille.venuesSecurity')}>
              {venues.map(v => (
                <View key={v.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: AccueilProColors.borderSubtle }}>
                  <Text style={{ fontWeight: '700' }}>{v.name}</Text>
                  <Text style={{ fontSize: 12, color: AccueilProColors.textMuted, marginTop: 4 }}>
                    ERP {v.erp_type ?? '?'} · {v.fire_notes ?? '—'}
                  </Text>
                </View>
              ))}
            </AccueilProSectionCard>
          : null}

          <AccueilProSectionCard title={t('accueilpro.feuille.notes')}>
            <TextInput
              value={note}
              onChangeText={setNote}
              onBlur={() => void saveApDayNote(date, note)}
              multiline
              numberOfLines={5}
              placeholder={t('accueilpro.feuille.notesPlaceholder')}
              style={{ backgroundColor: AccueilProColors.cream, borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top' }}
            />
          </AccueilProSectionCard>
        </>}
    </AccueilProScreenLayout>
  );
}
