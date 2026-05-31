import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { ApDayPlanItem } from '../../types/accueilPro';
import { formatDayPlanTimeRange } from '../../lib/accueilProDayPlanHelpers';
import {
  AccueilProColors,
  AccueilProDeleteIconButton,
  AccueilProEmpty,
  AccueilProLinkButton,
  apStyles,
} from './AccueilProUI';

export type EventDayAgendaTimelineProps = {
  items: ApDayPlanItem[];
  planDate: string;
  emptyMessage: string;
  addLabel: string;
  seedLabel: string;
  onAdd: () => void;
  onSeed: () => void;
  onPressItem: (item: ApDayPlanItem) => void;
  onDeleteItem?: (item: ApDayPlanItem) => void;
  deleteAccessibilityLabel?: string;
  whereLabel: (item: ApDayPlanItem) => string;
  labels: {
    who: string;
    where: string;
    linkedNotes: string;
  };
};

export function EventDayAgendaTimeline(props: EventDayAgendaTimelineProps) {
  const {
    items,
    planDate,
    emptyMessage,
    addLabel,
    seedLabel,
    onAdd,
    onSeed,
    onPressItem,
    onDeleteItem,
    deleteAccessibilityLabel,
    whereLabel,
    labels,
  } = props;

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <AccueilProLinkButton label={addLabel} onPress={onAdd} />
        <AccueilProLinkButton label={seedLabel} onPress={onSeed} />
      </View>

      <View
        style={{
          backgroundColor: AccueilProColors.navy,
          borderRadius: 12,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase' }}>
          Agenda
        </Text>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginTop: 4 }}>{planDate}</Text>
      </View>

      {items.length === 0 ?
        <AccueilProEmpty emoji="🗓" message={emptyMessage} />
      : (
        <View style={{ borderLeftWidth: 3, borderLeftColor: AccueilProColors.gold, paddingLeft: 14 }}>
          {items.map((item, index) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginBottom: index < items.length - 1 ? 16 : 0,
                paddingBottom: index < items.length - 1 ? 16 : 0,
                borderBottomWidth: index < items.length - 1 ? 1 : 0,
                borderBottomColor: AccueilProColors.borderSubtle,
              }}
            >
              <TouchableOpacity style={{ flex: 1, paddingRight: 4 }} onPress={() => onPressItem(item)}>
              <Text style={{ fontWeight: '800', color: AccueilProColors.gold, fontSize: 15, marginBottom: 6 }}>
                {formatDayPlanTimeRange(item)}
              </Text>
              <Text style={{ fontWeight: '700', fontSize: 16, color: AccueilProColors.textPrimary, marginBottom: 8 }}>
                {item.title}
              </Text>
              <Text style={apStyles.rowMeta}>
                {labels.who} : {item.assignee_name?.trim() || '—'}
              </Text>
              <Text style={[apStyles.rowMeta, { marginTop: 4 }]}>
                {labels.where} : {whereLabel(item)}
              </Text>
              {item.notes?.trim() ?
                <Text style={[apStyles.rowMeta, { marginTop: 6, fontStyle: 'italic' }]}>
                  {labels.linkedNotes} : {item.notes.trim()}
                </Text>
              : null}
              </TouchableOpacity>
              {onDeleteItem && deleteAccessibilityLabel ?
                <AccueilProDeleteIconButton
                  accessibilityLabel={deleteAccessibilityLabel}
                  onPress={() => onDeleteItem(item)}
                />
              : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
