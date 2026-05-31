import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { ContactDisplayLine } from '../../lib/accueilProContactDisplay';
import { ContactActionRow } from './ContactActionRow';
import { ContactAvatar } from './ContactAvatar';
import { AccueilProColors, apStyles } from './AccueilProUI';

function ContactLine({ label, value }: ContactDisplayLine) {
  return (
    <View style={{ marginTop: 8, width: '100%' }}>
      <Text
        style={{ fontSize: 15, lineHeight: 22, color: AccueilProColors.textPrimary, flexShrink: 1 }}
      >
        <Text style={apStyles.detailLabel}>{label} : </Text>
        <Text style={{ fontWeight: '600', color: AccueilProColors.textSecondary }}>{value}</Text>
      </Text>
    </View>
  );
}

/** Fiche contact lisible : nom sur une ligne, puis une ligne par champ (rôle, tél., e-mail…). */
export function AccueilProContactCard(props: {
  displayName: string;
  lines: ContactDisplayLine[];
  badge?: string | null;
  phone?: string | null;
  email?: string | null;
  emailSubject?: string;
  photoUri?: string | null;
  onPress?: () => void;
  variant?: 'default' | 'permanentStaff';
  showChevron?: boolean;
}) {
  const showChevron = props.showChevron ?? !!props.onPress;
  const hasActions = Boolean(props.phone?.trim() || props.email?.trim());

  const card = (
    <View
      style={[
        apStyles.formCard,
        {
          marginBottom: 10,
          paddingVertical: 14,
          width: '100%',
          maxWidth: '100%',
          alignSelf: 'stretch',
          overflow: 'hidden',
        },
        props.variant === 'permanentStaff' ?
          {
            backgroundColor: '#FBF6EA',
            borderLeftWidth: 4,
            borderLeftColor: AccueilProColors.gold,
          }
        : null,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <ContactAvatar displayName={props.displayName} photoUri={props.photoUri} size={52} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: AccueilProColors.navy,
                  lineHeight: 24,
                }}
              >
                {props.displayName}
              </Text>
              {props.badge ?
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    fontWeight: '700',
                    color: AccueilProColors.gold,
                    letterSpacing: 0.3,
                  }}
                >
                  {props.badge}
                </Text>
              : null}
            </View>
            {showChevron && props.onPress ?
              <Text style={[apStyles.rowChevron, { marginTop: 2 }]}>›</Text>
            : null}
          </View>
        </View>
      </View>

      {props.lines.map(line => (
        <ContactLine key={`${line.label}-${line.value}`} label={line.label} value={line.value} />
      ))}

      {hasActions ?
        <View style={{ marginTop: 12, paddingTop: 4, width: '100%' }}>
          <ContactActionRow phone={props.phone} email={props.email} emailSubject={props.emailSubject} />
        </View>
      : null}
    </View>
  );

  if (!props.onPress) return card;

  return (
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.88} onPress={props.onPress}>
      {card}
    </TouchableOpacity>
  );
}
