import React, { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AccueilProEventBubble } from '../../components/accueilpro/AccueilProEventBubble';
import {
  AccueilProChip,
  AccueilProEmpty,
  AccueilProListRow,
  AccueilProScreenLayout,
  AccueilProStatusBadge,
  AccueilProTypeBadge,
  AccueilProColors,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { listApEvents, listApVenues } from '../../db/accueilProDb';
import { accueilProEventColor } from '../../lib/accueilProEventColors';
import { ClientReadOnlyBanner } from '../../modules/accueilpro/components/ClientReadOnlyBanner';
import { useAccueilProRole } from '../../modules/accueilpro/hooks/useAccueilProRole';
import type { ApEvent } from '../../types/accueilPro';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function AccueilProPlanningScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { isClientPortal } = useAccueilProRole();
  const [mode, setMode] = useState<'list' | 'calendar'>('calendar');
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<ApEvent[]>([]);
  const [venues, setVenues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [ev, vList] = await Promise.all([listApEvents(), listApVenues()]);
    setEvents(ev);
    setVenues(Object.fromEntries(vList.map(v => [v.id, v.name])));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const sorted = useMemo(() => [...events].sort((a, b) => (a.date_debut ?? '').localeCompare(b.date_debut ?? '')), [events]);

  const calendarCells = useMemo(() => {
    const yr = month.getFullYear();
    const mo = month.getMonth();
    const firstDow = (new Date(yr, mo, 1).getDay() + 6) % 7;
    const total = new Date(yr, mo + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDow).fill(null);
    for (let i = 1; i <= total; i++) cells.push(i);
    return cells;
  }, [month]);

  const eventsForDay = (day: number | null) => {
    if (!day) return [] as ApEvent[];
    const ds = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => (e.date_debut ?? '') <= ds && (e.date_fin ?? e.date_debut ?? '') >= ds);
  };

  const today = new Date();
  const isToday = (day: number | null) =>
    day != null && day === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📆</Text>}
      headerTitle={t('accueilpro.planning.title')}
      headerSubtitle={t('accueilpro.planning.subtitle')}
      loading={loading}
    >
      {isClientPortal ?
        <ClientReadOnlyBanner message={t('accueilpro.rbac.readOnlyBanner')} />
      : null}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <AccueilProChip label={t('accueilpro.planning.list')} selected={mode === 'list'} onPress={() => setMode('list')} />
        <AccueilProChip label={t('accueilpro.planning.calendar')} selected={mode === 'calendar'} onPress={() => setMode('calendar')} />
      </View>

      {mode === 'list' ?
        sorted.length === 0 ?
          <AccueilProEmpty message={t('accueilpro.planning.empty')} />
        : sorted.map(e => (
          <AccueilProListRow
            key={e.id}
            title={e.name}
            meta={`${venues[e.venue_id ?? ''] ?? '—'} · ${e.heure_debut ?? ''}–${e.heure_fin ?? ''}`}
            accentColor={accueilProEventColor(e.id).bg}
            onPress={() => navigation.navigate('AccueilProEventDetail', { id: e.id })}
            rightAccessory={
              <View style={{ gap: 4, alignItems: 'flex-end' }}>
                <AccueilProTypeBadge type={e.type} />
                <AccueilProStatusBadge status={e.status} />
              </View>
            }
          />
        ))
      : <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: AccueilProColors.borderSubtle }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={{ fontSize: 20, padding: 8 }}>‹</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: AccueilProColors.navy }}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
            <Text onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={{ fontSize: 20, padding: 8 }}>›</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {DAYS.map(d => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: AccueilProColors.textMuted, marginBottom: 4 }}>{d}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {calendarCells.map((day, i) => {
              const de = eventsForDay(day);
              const dayIso =
                day != null
                  ? `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  : '';
              return (
                <TouchableOpacity
                  key={i}
                  disabled={!day}
                  onPress={() => day && navigation.navigate('AccueilProDayPlan', { date: dayIso })}
                  style={{
                    width: `${100 / 7}%`,
                    minHeight: 64,
                    padding: 4,
                    borderWidth: 1,
                    borderColor: isToday(day) ? AccueilProColors.gold : AccueilProColors.borderSubtle,
                    backgroundColor: day ? '#FAFAF9' : 'transparent',
                  }}
                >
                  {day ?
                    <>
                      <Text style={{ fontWeight: isToday(day) ? '800' : '400', color: isToday(day) ? AccueilProColors.gold : AccueilProColors.textPrimary, fontSize: 12 }}>{day}</Text>
                      {de.slice(0, 2).map(ev => (
                        <AccueilProEventBubble
                          key={ev.id}
                          eventId={ev.id}
                          label={ev.name}
                          compact
                          style={{ marginTop: 2, alignSelf: 'stretch' }}
                          onPress={() => navigation.navigate('AccueilProEventDetail', { id: ev.id })}
                        />
                      ))}
                      {de.length > 2 ?
                        <Text style={{ fontSize: 9, color: AccueilProColors.textMuted, marginTop: 2, fontWeight: '700' }}>
                          +{de.length - 2}
                        </Text>
                      : null}
                    </>
                  : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>}
    </AccueilProScreenLayout>
  );
}
