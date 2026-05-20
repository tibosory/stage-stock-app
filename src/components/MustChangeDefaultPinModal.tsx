import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Shadow } from '../theme/colors';
import { Typography } from '../theme/typography';
import { useLanguage } from '../context/LanguageContext';
import { FACTORY_DEFAULT_PIN } from '../lib/pinAuth';

type Props = {
  visible: boolean;
  userName: string;
  onSubmit: (newPin: string) => Promise<{ ok: boolean; message?: string }>;
};

export function MustChangeDefaultPinModal({ visible, userName, onSubmit }: Props) {
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (pin.length < 4) {
      setError(t('pinChange.err.minLength'));
      return;
    }
    if (pin === FACTORY_DEFAULT_PIN) {
      setError(t('pinChange.err.stillDefault'));
      return;
    }
    if (pin !== confirm) {
      setError(t('pinChange.err.mismatch'));
      return;
    }
    setBusy(true);
    try {
      const r = await onSubmit(pin);
      if (!r.ok) {
        setError(r.message ?? t('pinChange.err.generic'));
        return;
      }
      setPin('');
      setConfirm('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => {}}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>{t('pinChange.title')}</Text>
          <Text style={s.body}>{t('pinChange.body', { name: userName })}</Text>
          <Text style={s.label}>{t('pinChange.newPin')}</Text>
          <TextInput
            style={s.input}
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={12}
            placeholder={t('login.device.pinPlaceholder')}
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={s.label}>{t('pinChange.confirmPin')}</Text>
          <TextInput
            style={s.input}
            value={confirm}
            onChangeText={setConfirm}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={12}
            placeholder={t('login.device.pinPlaceholder')}
            placeholderTextColor={Colors.textMuted}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <TouchableOpacity style={s.btn} onPress={() => void handleSubmit()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnTxt}>{t('pinChange.submit')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  title: { ...Typography.sectionTitle, fontSize: 20, marginBottom: 10 },
  body: { ...Typography.bodySecondary, marginBottom: 20 },
  label: { ...Typography.label, color: Colors.textPrimary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.bgInput,
    borderRadius: 14,
    padding: 14,
    fontSize: 18,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    letterSpacing: 4,
  },
  error: { color: Colors.red, fontSize: 13, marginBottom: 12 },
  btn: {
    backgroundColor: Colors.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnTxt: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});
