import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { AccueilProColors } from './AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';

type Props = {
  visible: boolean;
  title: string;
  uri: string | null;
  onClose: () => void;
};

export function AccueilProPdfPreviewModal({ visible, title, uri, onClose }: Props) {
  const { t } = useLanguage();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          {uri ?
            <WebView source={{ uri }} style={styles.webview} />
          : <Text style={styles.muted}>{t('accueilpro.conventions.pdfMissing')}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AccueilProColors.card },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AccueilProColors.borderSubtle,
    backgroundColor: AccueilProColors.cream,
  },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: AccueilProColors.navy },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: AccueilProColors.gold,
  },
  closeText: { fontWeight: '800', color: AccueilProColors.navy, fontSize: 14 },
  body: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#fff' },
  muted: { padding: 24, color: AccueilProColors.textMuted, textAlign: 'center' },
});
