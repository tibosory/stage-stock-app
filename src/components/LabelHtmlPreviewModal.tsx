import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { TabScreenSafeArea } from './UI';
import { Colors } from '../theme/colors';
import { prepareHtmlForPreview } from '../lib/labelCustomPdf';

type Props = {
  visible: boolean;
  title: string;
  /** Document HTML prêt (étiquette ou page) */
  fullHtml: string | null;
  loading?: boolean;
  onClose: () => void;
  /** Présent si l’on veut lancer l’impression / partage depuis l’aperçu */
  onGeneratePdf?: () => void;
  generateLabel?: string;
};

export default function LabelHtmlPreviewModal({
  visible,
  title,
  fullHtml,
  loading,
  onClose,
  onGeneratePdf,
  generateLabel = 'Générer le PDF',
}: Props) {
  const src = fullHtml
    ? prepareHtmlForPreview(fullHtml, { bannerTitle: `Aperçu — ${title}` })
    : '<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body></body></html>';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <TabScreenSafeArea style={s.safe} edges={['top', 'bottom']}>
        <View style={s.head}>
          <Text style={s.title} numberOfLines={2}>
            Aperçu
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={s.close}>✕</Text>
          </TouchableOpacity>
        </View>
        {loading || !fullHtml ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={Colors.green} />
            <Text style={s.loadText}>
              {loading ? 'Génération de l’aperçu…' : 'Aucun contenu'}
            </Text>
          </View>
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html: src, baseUrl: '' }}
            style={s.web}
            setBuiltInZoomControls
            setDisplayZoomControls
            javaScriptEnabled
            mixedContentMode="always"
          />
        )}
        <View style={s.footer}>
          {onGeneratePdf && fullHtml && !loading ? (
            <TouchableOpacity style={s.genBtn} onPress={onGeneratePdf}>
              <Text style={s.genText}>{generateLabel}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={s.backBtn} onPress={onClose}>
            <Text style={s.backText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </TabScreenSafeArea>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { flex: 1, color: Colors.white, fontSize: 17, fontWeight: '800' },
  close: { color: Colors.textMuted, fontSize: 24, padding: 4 },
  web: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadText: { color: Colors.textMuted, marginTop: 12, fontSize: 14 },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: Colors.border, gap: 8 },
  genBtn: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  genText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  backBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 15 },
});
