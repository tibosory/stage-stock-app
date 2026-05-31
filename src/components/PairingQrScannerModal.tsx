import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { completePairingFromScan } from '../lib/completePairingFromScan';
import { useLanguage } from '../context/LanguageContext';
import { useConnection } from '../context/ConnectionContext';
import { setPairingInProgress } from '../lib/pairingSessionGuard';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (baseUrl: string) => void;
};

export function PairingQrScannerModal({ visible, onClose, onSuccess }: Props) {
  const insets = useSafeAreaInsets();
  const { language, t } = useLanguage();
  const { refresh } = useConnection();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setScanned(false);
    setBusy(false);
    setError(null);
    setPairingInProgress(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (visible) {
      setPairingInProgress(true);
    } else {
      setPairingInProgress(false);
    }
    return () => setPairingInProgress(false);
  }, [visible]);

  const handleBarcode = useCallback(
    async (result: BarcodeScanningResult) => {
      if (scanned || busy) return;
      setScanned(true);
      setBusy(true);
      setError(null);
      setPairingInProgress(true);
      Vibration.vibrate(80);
      try {
        const outcome = await completePairingFromScan(result.data, language);
        if (outcome.kind === 'success') {
          await refresh();
          reset();
          onSuccess(outcome.baseUrl);
          return;
        }
        if (outcome.kind === 'error') {
          setError(`${outcome.title}\n\n${outcome.message}`);
          setScanned(false);
        } else if (outcome.kind === 'not_pairing') {
          setError(t('onboarding.scanPairingWrongQr'));
          setScanned(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setScanned(false);
      } finally {
        setBusy(false);
      }
    },
    [busy, language, onSuccess, refresh, reset, scanned]
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.root}>
        {!permission?.granted ? (
          <View style={[styles.center, { paddingTop: insets.top }]}>
            <Text style={styles.hint}>{t('scanner.cameraPermission')}</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => void requestPermission()}>
              <Text style={styles.btnPrimaryText}>{t('scanner.allowCamera')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={{ marginTop: 16 }}>
              <Text style={styles.link}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcode}
            />
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={handleClose} hitSlop={12}>
                <Text style={styles.link}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.title}>{t('onboarding.scanPairingQr')}</Text>
              <View style={{ width: 56 }} />
            </View>
            <View style={styles.overlay}>
              <View style={styles.frame} />
              <Text style={styles.scanHint}>{t('onboarding.scanPairingHint')}</Text>
            </View>
            {(busy || error) && (
              <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
                {busy ? <ActivityIndicator color={Colors.white} /> : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Colors.bg },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 2,
  },
  title: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  link: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: Colors.green,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scanHint: {
    marginTop: 20,
    color: Colors.white,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  error: { color: '#fca5a5', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  hint: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  btnPrimary: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  btnPrimaryText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
});
