import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccueilProColors } from './AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { loadLocalPdfPreviewHtml } from '../../lib/localPdfWebViewHtml';
import { effectiveBottomInset, effectiveTopInset } from '../../lib/deviceSafeArea';

type Props = {
  visible: boolean;
  title: string;
  uri: string | null;
  onClose: () => void;
};

export function AccueilProPdfPreviewModal({ visible, title, uri, onClose }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const topInset = effectiveTopInset(insets.top);
  const bottomInset = effectiveBottomInset(insets.bottom);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !uri) {
      setPreviewHtml(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setPreviewHtml(null);

    void loadLocalPdfPreviewHtml(uri)
      .then(html => {
        if (!cancelled) setPreviewHtml(html);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setLoadError(msg === 'PDF_NOT_FOUND' ? t('accueilpro.conventions.pdfMissing') : msg === 'PDF_EMPTY' ? t('accueilpro.conventions.pdfMissing') : msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, uri]);

  const onOpenExternal = async () => {
    if (!uri) return;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t('accueilpro.conventions.pdfTitle'), t('mat.shareUnavailable'));
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: title,
      });
    } catch (e: unknown) {
      Alert.alert(t('accueilpro.conventions.pdfTitle'), e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.topBar}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          {!uri ?
            <Text style={styles.muted}>{t('accueilpro.conventions.pdfMissing')}</Text>
          : loading ?
            <View style={styles.center}>
              <ActivityIndicator size="large" color={AccueilProColors.gold} />
            </View>
          : loadError ?
            <View style={styles.center}>
              <Text style={styles.muted}>{loadError}</Text>
              <TouchableOpacity style={styles.externalBtn} onPress={() => void onOpenExternal()}>
                <Text style={styles.externalText}>{t('tour.detail.openWithSystem')}</Text>
              </TouchableOpacity>
            </View>
          : previewHtml ?
            <WebView
              originWhitelist={['*']}
              source={{ html: previewHtml, baseUrl: 'https://cdnjs.cloudflare.com' }}
              style={styles.webview}
              setBuiltInZoomControls
              setDisplayZoomControls
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              allowFileAccess
              allowUniversalAccessFromFileURLs
            />
          : null}
        </View>
        {uri && !loading && !loadError ?
          <View style={styles.footer}>
            <TouchableOpacity style={styles.externalBtn} onPress={() => void onOpenExternal()}>
              <Text style={styles.externalText}>{t('tour.detail.openWithSystem')}</Text>
            </TouchableOpacity>
          </View>
        : null}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  muted: { color: AccueilProColors.textMuted, textAlign: 'center' },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AccueilProColors.borderSubtle,
    backgroundColor: AccueilProColors.cream,
  },
  externalBtn: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AccueilProColors.borderSubtle,
    backgroundColor: '#fff',
  },
  externalText: { fontWeight: '700', color: AccueilProColors.navy },
});
