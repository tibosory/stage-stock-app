import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { AccueilProColors, apStyles } from './AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { useAppAuth } from '../../context/AuthContext';
import { accueilProEventColor } from '../../lib/accueilProEventColors';
import {
  buildEventReadinessSnapshot,
  toggleEventReadinessManual,
  type EventReadinessSnapshot,
  type ReadinessCheck,
  type ReadinessCheckId,
} from '../../lib/accueilProEventReadiness';

const MANUAL_KEYS: ReadinessCheckId[] = ['briefing_done', 'access_ok'];

type Props = {
  eventId: string;
  onChanged?: () => void;
};

function CheckRow(props: {
  label: string;
  check: ReadinessCheck;
  onToggle?: () => void;
}) {
  const { label, check, onToggle } = props;
  const icon =
    check.state === 'ok' ? '✓'
    : check.state === 'partial' ? '◐'
    : '○';
  const color =
    check.state === 'ok' ? AccueilProColors.statusConfirme
    : check.state === 'partial' ? AccueilProColors.gold
    : AccueilProColors.textMuted;

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: check.state === 'ok' ? 8 : 0,
        borderRadius: check.state === 'ok' ? 8 : 0,
        backgroundColor: check.state === 'ok' ? 'rgba(46,125,90,0.12)' : 'transparent',
      }}
    >
      <Text style={{ fontSize: 18, color, width: 22 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600', fontSize: 14 }}>{label}</Text>
        {check.detail ?
          <Text style={{ fontSize: 12, color: AccueilProColors.textMuted, marginTop: 2 }}>{check.detail}</Text>
        : null}
      </View>
      {check.auto ?
        <Text style={{ fontSize: 10, color: AccueilProColors.textMuted, textTransform: 'uppercase' }}>auto</Text>
      : null}
    </View>
  );

  if (onToggle) {
    return (
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

export function EventReadinessChecklist(props: Props) {
  const { eventId, onChanged } = props;
  const { t } = useLanguage();
  const { user } = useAppAuth();
  const [snap, setSnap] = useState<EventReadinessSnapshot | null>(null);

  const reload = useCallback(async () => {
    setSnap(await buildEventReadinessSnapshot(eventId));
  }, [eventId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const onToggleManual = (key: 'briefing_done' | 'access_ok') => {
    void (async () => {
      const current = snap?.manual[key]?.checked ?? false;
      await toggleEventReadinessManual(eventId, key, !current, user?.nom);
      await reload();
      onChanged?.();
    })();
  };

  if (!snap) return null;

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={apStyles.sectionTitle}>{t('accueilpro.readiness.title')}</Text>
        <Text style={{ fontWeight: '800', color: AccueilProColors.gold }}>{snap.score}%</Text>
      </View>
      <Text style={[apStyles.hint, { marginBottom: 10 }]}>{t('accueilpro.readiness.hint')}</Text>
      {snap.checks.map(check => (
        <CheckRow
          key={check.id}
          label={t(`accueilpro.readiness.check.${check.id}`)}
          check={check}
          onToggle={MANUAL_KEYS.includes(check.id) ? () => onToggleManual(check.id as 'briefing_done' | 'access_ok') : undefined}
        />
      ))}
    </View>
  );
}

export function EventDayReadinessCard(props: {
  snap: EventReadinessSnapshot;
  onPress: () => void;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const { snap, onPress, t } = props;
  const eventColor = accueilProEventColor(snap.event.id);
  const scoreColor =
    snap.level === 'green' ? AccueilProColors.statusConfirme
    : snap.level === 'red' ? AccueilProColors.statusAnnule
    : AccueilProColors.gold;

  const missing = snap.checks.filter(c => c.state !== 'ok').length;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: AccueilProColors.borderSubtle,
        borderLeftWidth: 4,
        borderLeftColor: eventColor.bg,
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        backgroundColor: '#fff',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontWeight: '700', fontSize: 15, flex: 1 }}>{snap.event.name}</Text>
        <Text style={{ fontWeight: '800', color: scoreColor }}>{snap.score}%</Text>
      </View>
      <Text style={{ fontSize: 12, color: AccueilProColors.textMuted, marginTop: 4 }}>
        {[snap.event.heure_debut, snap.event.heure_fin ? `→ ${snap.event.heure_fin}` : '']
          .filter(Boolean)
          .join(' ')}
      </Text>
      <Text style={{ fontSize: 12, color: AccueilProColors.textSecondary, marginTop: 6 }}>
        {missing === 0 ?
          t('accueilpro.readiness.allOk')
        : t('accueilpro.readiness.pending', { count: String(missing) })}
      </Text>
    </TouchableOpacity>
  );
}
