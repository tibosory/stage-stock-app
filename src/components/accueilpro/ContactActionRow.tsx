import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { openEmail, openPhone, openSms } from '../../lib/contactActions';
import { AccueilProColors, apStyles } from './AccueilProUI';

/** Boutons téléphone / SMS / mail — cibles larges pour usage terrain. */
export function ContactActionRow(props: {
  phone?: string | null;
  email?: string | null;
  emailSubject?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {props.phone ?
        <>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void openPhone(props.phone)}
            style={[apStyles.contactPill, { backgroundColor: 'rgba(46,125,90,0.12)', borderColor: 'rgba(46,125,90,0.35)' }]}
          >
            <Text style={apStyles.actionOk}>📞 Appeler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void openSms(props.phone, null)}
            style={[apStyles.contactPill, { backgroundColor: AccueilProColors.surfaceMuted, borderColor: AccueilProColors.borderSubtle }]}
          >
            <Text style={apStyles.actionText}>💬 SMS</Text>
          </TouchableOpacity>
        </>
      : null}
      {props.email ?
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => void openEmail(props.email, props.emailSubject ? { subject: props.emailSubject } : undefined)}
          style={[apStyles.contactPill, { backgroundColor: 'rgba(64,104,224,0.1)', borderColor: 'rgba(64,104,224,0.28)' }]}
        >
          <Text style={[apStyles.actionText, { color: AccueilProColors.primary }]}>✉ Mail</Text>
        </TouchableOpacity>
      : null}
    </View>
  );
}
