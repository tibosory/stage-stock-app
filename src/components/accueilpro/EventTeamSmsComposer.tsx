import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  AccueilProChip,
  AccueilProColors,
  AccueilProFormCard,
  AccueilProInput,
  AccueilProPrimaryButton,
  apStyles,
} from './AccueilProUI';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '../../theme/spacing';
import { effectiveBottomInset, effectiveTopInset } from '../../lib/deviceSafeArea';
import { listEventTeamSmsRecipients, sendSmsToPhones } from '../../lib/eventTeamSms';
import type { ApEventPersonnel } from '../../types/accueilPro';

export type EventTeamSmsComposerLabels = {
  title: string;
  hint: string;
  fieldMessage: string;
  placeholder: string;
  recipients: string;
  withoutPhone: string;
  send: string;
  cancel: string;
  errEmpty: string;
  noPhones: string;
  unavailable: string;
  quickBreak: string;
  quickStart: string;
};

type Props = {
  visible: boolean;
  team: ApEventPersonnel[];
  eventName?: string | null;
  labels: EventTeamSmsComposerLabels;
  errTitle: string;
  onClose: () => void;
};

export function EventTeamSmsComposer(props: Props) {
  const { visible, team, labels, errTitle, onClose } = props;
  const insets = useSafeAreaInsets();
  const topInset = effectiveTopInset(insets.top);
  const bottomInset = effectiveBottomInset(insets.bottom);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) setMessage('');
  }, [visible]);

  const { withPhone, withoutPhone } = useMemo(() => listEventTeamSmsRecipients(team), [team]);

  const onSend = async () => {
    if (withPhone.length === 0) {
      Alert.alert(errTitle, labels.noPhones);
      return;
    }
    if (!message.trim()) {
      Alert.alert(errTitle, labels.errEmpty);
      return;
    }
    setSending(true);
    try {
      const result = await sendSmsToPhones(
        withPhone.map(r => r.phone),
        message.trim()
      );
      if (result === 'unavailable') Alert.alert(errTitle, labels.unavailable);
      if (result === 'sent') onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.45)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            maxHeight: '92%',
            backgroundColor: AccueilProColors.card,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingHorizontal: Spacing.md,
            paddingTop: Spacing.md + topInset,
            paddingBottom: Spacing.lg + bottomInset,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[apStyles.sectionTitle, { flex: 1 }]}>{labels.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={apStyles.sectionLink}>{labels.cancel}</Text>
            </TouchableOpacity>
          </View>

          {props.eventName?.trim() ?
            <Text style={[apStyles.rowMeta, { marginBottom: Spacing.sm }]}>{props.eventName.trim()}</Text>
          : null}

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[apStyles.hint, { marginBottom: Spacing.sm }]}>{labels.hint}</Text>

            <AccueilProFormCard style={{ marginBottom: Spacing.sm }}>
              <Text style={apStyles.detailLabel}>
                {labels.recipients.replace('{n}', String(withPhone.length))}
              </Text>
              {withPhone.length === 0 ?
                <Text style={[apStyles.empty, { marginTop: 8 }]}>{labels.noPhones}</Text>
              : (
                <Text style={[apStyles.rowMeta, { marginTop: 8, lineHeight: 20 }]}>
                  {withPhone.map(r => r.name).join(' · ')}
                </Text>
              )}
              {withoutPhone.length > 0 ?
                <Text style={[apStyles.hint, { marginTop: 10 }]}>
                  {labels.withoutPhone.replace('{n}', String(withoutPhone.length))} :{' '}
                  {withoutPhone.map(r => r.name).join(', ')}
                </Text>
              : null}
            </AccueilProFormCard>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm }}>
              <AccueilProChip label={labels.quickBreak} onPress={() => setMessage(labels.quickBreak)} />
              <AccueilProChip label={labels.quickStart} onPress={() => setMessage(labels.quickStart)} />
            </View>

            <AccueilProInput
              label={labels.fieldMessage}
              value={message}
              onChangeText={setMessage}
              placeholder={labels.placeholder}
              multiline
            />

            <AccueilProPrimaryButton
              label={labels.send}
              onPress={() => void onSend()}
              loading={sending}
              style={{ marginTop: Spacing.xs }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
