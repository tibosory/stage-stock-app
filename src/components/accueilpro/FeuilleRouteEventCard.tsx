import React from 'react';
import { Text, View } from 'react-native';
import {
  AccueilProSectionCard,
  AccueilProStatusBadge,
  AccueilProTypeBadge,
  AccueilProColors,
} from './AccueilProUI';
import { formatDayPlanTimeRange } from '../../lib/accueilProDayPlanHelpers';
import { accueilProEventColor } from '../../lib/accueilProEventColors';
import type { FeuilleEventSynthesis } from '../../lib/accueilProFeuilleRouteBuilder';

type Props = {
  block: FeuilleEventSynthesis;
  spaceNames: Record<string, string>;
  t: (key: string) => string;
};

export function FeuilleRouteEventCard({ block, spaceNames, t }: Props) {
  const ev = block.event;
  const dates =
    ev.date_fin && ev.date_fin !== ev.date_debut ?
      `${ev.date_debut} → ${ev.date_fin}`
    : ev.date_debut;

  return (
    <AccueilProSectionCard
      title={ev.name}
      style={{ borderLeftWidth: 4, borderLeftColor: accueilProEventColor(ev.id).bg }}
    >
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

      {block.venueEquipment.trim() || block.materialRows.length > 0 ?
        <>
          <Text style={{ fontWeight: '700', fontSize: 13, marginTop: 12, marginBottom: 6 }}>
            {t('accueilpro.feuille.materialSection')}
          </Text>
          {block.venueEquipment.trim() ?
            <View
              style={{
                backgroundColor: AccueilProColors.cream,
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                {t('accueilpro.feuille.materialVenue')}
              </Text>
              <Text style={{ fontSize: 13, color: AccueilProColors.textSecondary }}>{block.venueEquipment.trim()}</Text>
            </View>
          : null}
          {block.materialRows.map(row => (
            <View
              key={row.spaceId}
              style={{
                backgroundColor: AccueilProColors.cream,
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{row.spaceName}</Text>
              <Text style={{ fontSize: 13, color: AccueilProColors.textSecondary }}>{row.equipment}</Text>
            </View>
          ))}
        </>
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
