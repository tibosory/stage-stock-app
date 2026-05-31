import React from 'react';
import { Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { openEmail, openPhone, openSms } from '../../lib/contactActions';
import { AccueilProColors, apStyles } from './AccueilProUI';

const pillFlex: ViewStyle = {
  flex: 1,
  minWidth: 0,
  paddingHorizontal: 10,
};

const pillFull: ViewStyle = {
  width: '100%',
  alignSelf: 'stretch',
  paddingHorizontal: 12,
};

/** Boutons téléphone / SMS / mail — empilés pour tenir sur petits écrans. */
export function ContactActionRow(props: {
  phone?: string | null;
  email?: string | null;
  emailSubject?: string;
}) {
  const hasPhone = Boolean(props.phone?.trim());
  const hasEmail = Boolean(props.email?.trim());

  return (
    <View style={{ width: '100%', gap: 8 }}>
      {hasPhone ?
        <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void openPhone(props.phone)}
            style={[
              apStyles.contactPill,
              pillFlex,
              { backgroundColor: 'rgba(46,125,90,0.12)', borderColor: 'rgba(46,125,90,0.35)' },
            ]}
          >
            <Text style={apStyles.actionOk} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              📞 Appeler
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void openSms(props.phone, null)}
            style={[
              apStyles.contactPill,
              pillFlex,
              { backgroundColor: AccueilProColors.surfaceMuted, borderColor: AccueilProColors.borderSubtle },
            ]}
          >
            <Text style={apStyles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              💬 SMS
            </Text>
          </TouchableOpacity>
        </View>
      : null}
      {hasEmail ?
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() =>
            void openEmail(props.email, props.emailSubject ? { subject: props.emailSubject } : undefined)
          }
          style={[
            apStyles.contactPill,
            pillFull,
            { backgroundColor: 'rgba(200,151,58,0.12)', borderColor: 'rgba(200,151,58,0.35)' },
          ]}
        >
          <Text
            style={[apStyles.actionText, { color: AccueilProColors.gold, fontWeight: '800' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            ✉ Mail
          </Text>
        </TouchableOpacity>
      : null}
    </View>
  );
}
