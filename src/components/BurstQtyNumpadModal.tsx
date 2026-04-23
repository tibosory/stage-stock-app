// Pavé numérique plein écran pour quantité (mode rafale consommables).
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';

const MAX_DIGITS = 5;
const MAX_QTY = 99_999;

const ANDROID_BOTTOM_INSET_MIN_DP = 52;

type Props = {
  visible: boolean;
  productName: string;
  stockHint?: string;
  unite: string;
  moveType: 'entrée' | 'sortie';
  /** Valeur de départ (ex. quantité préréglée sur l’écran d’accueil). */
  initialQtyString: string;
  onCancel: () => void;
  onConfirm: (qty: number) => void;
};

function normalizeInitial(s: string): string {
  const d = s.replace(/\D/g, '');
  if (!d) return '1';
  const n = Math.min(parseInt(d, 10) || 1, MAX_QTY);
  return String(n);
}

export function BurstQtyNumpadModal({
  visible,
  productName,
  stockHint,
  unite,
  moveType,
  initialQtyString,
  onCancel,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const androidBottom =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, ANDROID_BOTTOM_INSET_MIN_DP)
      : Math.max(insets.bottom, 16);

  const [digits, setDigits] = useState('1');

  useEffect(() => {
    if (visible) {
      setDigits(normalizeInitial(initialQtyString));
    }
  }, [visible, initialQtyString]);

  const display = digits || '0';
  const append = (d: string) => {
    setDigits(prev => {
      const next = (prev + d).replace(/\D/g, '');
      if (next.length > MAX_DIGITS) return prev;
      const n = parseInt(next, 10);
      if (Number.isNaN(n)) return '';
      if (n > MAX_QTY) return String(MAX_QTY);
      return String(n);
    });
  };

  const back = () => {
    setDigits(prev => (prev.length <= 1 ? '' : prev.slice(0, -1)));
  };

  const clear = () => setDigits('');

  const handleConfirm = () => {
    const n = Math.max(0, parseInt(digits || '0', 10));
    if (n <= 0 || n > MAX_QTY) {
      Alert.alert('Quantité invalide', 'Indiquez un nombre entre 1 et 99 999.');
      return;
    }
    onConfirm(n);
  };

  const moveVerb = moveType === 'entrée' ? 'Entrée' : 'Sortie';
  const sign = moveType === 'entrée' ? '+' : '−';
  const preview = `${sign}${display} ${unite}`.trim();

  const pad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay} accessibilityViewIsModal>
        <View style={styles.topPad} />
        <View style={[styles.sheet, { paddingBottom: 20 + androidBottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Quantité</Text>
            <TouchableOpacity
              onPress={onCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.product} numberOfLines={3}>
            {productName}
          </Text>
          {stockHint ? <Text style={styles.stockHint}>{stockHint}</Text> : null}

          <View style={styles.modeRow}>
            <Text style={styles.modeBadge}>
              {moveVerb} — {preview}
            </Text>
          </View>

          <View style={styles.displayWrap}>
            <Text style={styles.display} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45}>
              {display}
            </Text>
            <Text style={styles.uniteLabel}>{unite}</Text>
          </View>

          {pad.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map(d => (
                <TouchableOpacity
                  key={d}
                  style={styles.key}
                  onPress={() => append(d)}
                  activeOpacity={0.65}
                >
                  <Text style={styles.keyText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          <View style={styles.row}>
            <TouchableOpacity style={[styles.key, styles.keyMuted]} onPress={back} activeOpacity={0.65}>
              <Text style={styles.keyText}>⌫</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.key} onPress={() => append('0')} activeOpacity={0.65}>
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.key, styles.keyMuted]} onPress={clear} activeOpacity={0.65}>
              <Text style={[styles.keyText, { fontSize: 18 }]}>Effacer</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnGhost} onPress={onCancel} activeOpacity={0.75}>
              <Text style={styles.btnGhostText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnOk} onPress={handleConfirm} activeOpacity={0.85}>
              <Text style={styles.btnOkText}>Valider {sign}{display} {unite}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const KEY_H = 58;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  topPad: { flex: 1 },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { color: Colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  close: { color: Colors.textMuted, fontSize: 22, padding: 4 },
  product: { color: Colors.white, fontSize: 17, fontWeight: '800', marginBottom: 4, lineHeight: 22 },
  stockHint: { color: Colors.textSecondary, fontSize: 12, marginBottom: 6 },
  modeRow: { marginBottom: 10 },
  modeBadge: {
    alignSelf: 'flex-start',
    color: Colors.green,
    fontSize: 14,
    fontWeight: '800',
  },
  displayWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
    minHeight: 56,
  },
  display: {
    color: Colors.white,
    fontSize: 48,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  uniteLabel: { color: Colors.textMuted, fontSize: 20, fontWeight: '600', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10, justifyContent: 'center' },
  key: {
    flex: 1,
    minHeight: KEY_H,
    maxHeight: KEY_H,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyMuted: { backgroundColor: Colors.bgInput },
  keyText: { color: Colors.white, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnGhost: {
    flex: 0.38,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  btnGhostText: { color: Colors.textSecondary, fontWeight: '800', fontSize: 15 },
  btnOk: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.green,
    alignItems: 'center',
  },
  btnOkText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
});
