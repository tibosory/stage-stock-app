import React from 'react';
import { Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { accueilProEventColor } from '../../lib/accueilProEventColors';

/** Bulle compacte colorée par événement (calendrier, planning, listes). */
export function AccueilProEventBubble(props: {
  eventId: string;
  label: string;
  onPress?: () => void;
  compact?: boolean;
  style?: ViewStyle;
}) {
  const colors = accueilProEventColor(props.eventId);
  const compact = props.compact ?? false;

  const boxStyle: ViewStyle = {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: compact ? 4 : 8,
    paddingHorizontal: compact ? 4 : 8,
    paddingVertical: compact ? 2 : 4,
    maxWidth: '100%',
    alignSelf: 'flex-start',
    ...props.style,
  };

  const text = (
    <Text
      numberOfLines={1}
      style={{
        fontSize: compact ? 9 : 12,
        fontWeight: '700',
        color: colors.text,
      }}
    >
      {props.label}
    </Text>
  );

  if (props.onPress) {
    return (
      <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} onPress={props.onPress} style={boxStyle}>
        {text}
      </TouchableOpacity>
    );
  }

  return <View style={boxStyle}>{text}</View>;
}
