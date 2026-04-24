import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Colors, Shadow } from '../theme/colors';
import { Card, Input, BottomModal } from './UI';
import { resolveWindowsServerInstallerUrl, type WindowsInstallerResolved } from '../config/installerUrls';

/**
 * Android uniquement : téléchargement de l’installateur serveur local Windows (PocketBase + scripts).
 */
export function WindowsInstallerCard() {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<WindowsInstallerResolved | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [receiverUploadUrl, setReceiverUploadUrl] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [scanSuccessHintVisible, setScanSuccessHintVisible] = useState(false);
  const [camPerm, requestCamPerm] = useCameraPermissions();

  useEffect(() => {
    if (!scanSuccessHintVisible) return;
    const t = setTimeout(() => setScanSuccessHintVisible(false), 1400);
    return () => clearTimeout(t);
  }, [scanSuccessHintVisible]);

  const normalizeReceiverUploadUrl = useCallback((raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    return withProto.replace(/\/+$/, '');
  }, []);

  const downloadInstallerToCache = useCallback(async (): Promise<{ uri: string; resolved: WindowsInstallerResolved }> => {
    const cacheBase = FileSystem.cacheDirectory;
    if (!cacheBase) {
      throw new Error('Cache indisponible sur cet appareil.');
    }
    const resolved = await resolveWindowsServerInstallerUrl();
    setInfo(resolved);
    if (!resolved.url?.trim()) {
      throw new Error(
        "Aucun URL d'installateur : définissez EXPO_PUBLIC_WINDOWS_INSTALLER_URL au build, ou " +
          'expo.extra (windowsInstallerUrl / installerGitHubRepo) dans app.json, puis regénérez l\u0027APK. ' +
          'Vous pouvez envoyer l\u0027EXE via le PC (champ /upload) ci-dessous.'
      );
    }
    const target = `${cacheBase}Stagestock-Installer.exe`;
    await FileSystem.deleteAsync(target, { idempotent: true });
    const dl = await FileSystem.downloadAsync(resolved.url, target);
    if (dl.status < 200 || dl.status >= 300) {
      if (dl.status === 404) {
        throw new Error(
          'Fichier introuvable (404) : aucune release GitHub ne contient Stagestock-Installer.exe à cette URL, ' +
            "ou l'URL personnalisée (app) est erronée. " +
            'Publiez le build (tag v… sur le dépôt) ou hébergez l’EXE ailleurs et indiquez extra.windowsInstallerUrl (ou EXPO_PUBLIC_WINDOWS_INSTALLER_URL). ' +
            `URL tentée : ${resolved.url}`
        );
      }
      throw new Error(`Téléchargement échoué (HTTP ${dl.status}). ${resolved.url}`);
    }
    return { uri: dl.uri, resolved };
  }, []);

  /**
   * Ouvrir l’URL directe d’un .exe dans le navigateur Android donne souvent une page noire / chargement infini.
   * On télécharge dans l’app puis on ouvre le menu Partager (Bluetooth, Drive, USB, etc.).
   */
  const onPress = useCallback(async () => {
    setBusy(true);
    try {
      const { uri, resolved } = await downloadInstallerToCache();
      setInfo(resolved);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/octet-stream',
          dialogTitle: 'Envoyer Stagestock-Installer.exe vers le PC',
        });
        return;
      }
      const url = resolved.url;
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Partage impossible', `URL : ${url}`);
      }
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [downloadInstallerToCache]);

  const onSendToPc = useCallback(async () => {
    const target = normalizeReceiverUploadUrl(receiverUploadUrl);
    if (!target) {
      Alert.alert(
        'URL PC requise',
        'Lancez le script Receive-Installer.ps1 sur le PC puis collez l’URL /upload affichée.'
      );
      return;
    }
    setBusy(true);
    try {
      const { uri } = await downloadInstallerToCache();
      const up = await FileSystem.uploadAsync(target, uri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-StageStock-Filename': 'Stagestock-Installer.exe',
        },
      });
      if (up.status < 200 || up.status >= 300) {
        throw new Error(`Upload refusé (HTTP ${up.status}) ${up.body ? `\n${up.body}` : ''}`);
      }
      Alert.alert(
        'Transfert terminé',
        'Le fichier a été envoyé au PC. Lancez ensuite l’EXE depuis le dossier de réception.'
      );
    } catch (e) {
      Alert.alert('Erreur transfert', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [downloadInstallerToCache, normalizeReceiverUploadUrl, receiverUploadUrl]);

  const onOpenQrScan = useCallback(async () => {
    if (!camPerm?.granted) {
      const req = await requestCamPerm();
      if (!req.granted) {
        Alert.alert('Caméra requise', 'Autorisez la caméra pour scanner le QR du PC.');
        return;
      }
    }
    setScanLocked(false);
    setScanOpen(true);
  }, [camPerm?.granted, requestCamPerm]);

  const onQrScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (scanLocked) return;
      setScanLocked(true);
      const raw = String(data || '').trim();
      const normalized = normalizeReceiverUploadUrl(raw);
      if (normalized.includes('/upload')) {
        setReceiverUploadUrl(normalized);
        setScanSuccessHintVisible(true);
        setScanOpen(false);
        return;
      }
      Alert.alert(
        'QR non reconnu',
        'Ce QR ne contient pas une URL /upload pour le transfert d’installateur.'
      );
      setTimeout(() => setScanLocked(false), 800);
    },
    [normalizeReceiverUploadUrl, scanLocked]
  );

  if (Platform.OS !== 'android') return null;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Serveur sur votre PC (Windows)</Text>
      <Text style={styles.hint}>
        Méthode simple : appuyez ci-dessous — le fichier se prépare puis le menu Partager s’ouvre. Choisissez comment
        l’envoyer vers le PC (Bluetooth, Drive, e-mail, clé USB…). Sur le PC, double-cliquez l’EXE puis ouvrez
        « StageStock Local » et scannez le QR affiché.
      </Text>
      {info ? (
        <View style={styles.metaBox}>
          <Text style={styles.metaText}>
            {info.appVersion ? `APK ${info.appVersion}` : 'APK (version non lue)'} →{' '}
            {info.source === 'version-matched'
              ? `installateur compatible (${info.releaseTag ?? 'release'})`
              : info.source === 'custom'
                ? 'installateur personnalisé (config build)'
                : 'installateur latest (fallback)'}
          </Text>
        </View>
      ) : null}
      <TouchableOpacity style={styles.btn} onPress={onPress} disabled={busy} activeOpacity={0.85}>
        {busy ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.btnText}>Installer le serveur sur PC</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.advancedToggle}
        onPress={() => setShowAdvanced(v => !v)}
        activeOpacity={0.85}
      >
        <Text style={styles.advancedToggleText}>
          {showAdvanced ? 'Masquer options avancées' : 'Options avancées (technicien)'}
        </Text>
      </TouchableOpacity>
      {showAdvanced ? (
        <View style={styles.advancedBox}>
          <Text style={styles.advancedHint}>
            Envoi direct vers PC : lancez sur le PC le script `Receive-Installer.ps1`, puis collez ici l’URL
            `/upload?...` affichée.
          </Text>
          <Input
            label="URL de réception PC (/upload...)"
            value={receiverUploadUrl}
            onChangeText={setReceiverUploadUrl}
            placeholder="ex. http://192.168.1.40:8765/upload?token=..."
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity onPress={() => void onOpenQrScan()} style={styles.linkScan} activeOpacity={0.85}>
            <Text style={styles.linkScanText}>Scanner QR du PC</Text>
          </TouchableOpacity>
          {scanSuccessHintVisible ? (
            <View style={styles.scanOkPill}>
              <Text style={styles.scanOkText}>✅ URL remplie automatiquement</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.btnSecondary} onPress={onSendToPc} disabled={busy} activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color={Colors.green} />
            ) : (
              <Text style={styles.btnSecondaryText}>Télécharger puis envoyer au PC</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
      <BottomModal visible={scanOpen} onClose={() => setScanOpen(false)} title="Scanner le QR du PC">
        <Text style={styles.scanHelp}>
          Pointez la caméra vers le QR affiché sur le PC (script Receive-Installer.ps1).
        </Text>
        <View style={styles.scanFrame}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onQrScanned}
          />
        </View>
      </BottomModal>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  title: { color: Colors.white, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  hint: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  metaBox: {
    marginBottom: 10,
    backgroundColor: Colors.greenMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metaText: { color: Colors.green, fontSize: 12, fontWeight: '600' },
  btn: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadow.card,
  },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  advancedToggle: { marginTop: 8, alignSelf: 'flex-start', paddingVertical: 4 },
  advancedToggleText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  advancedBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    padding: 10,
  },
  advancedHint: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginBottom: 8 },
  linkScan: { alignSelf: 'flex-start', marginTop: -2, marginBottom: 8, paddingVertical: 4 },
  linkScanText: { color: Colors.blue, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  scanOkPill: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: Colors.greenBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scanOkText: { color: Colors.green, fontSize: 12, fontWeight: '700' },
  btnSecondary: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: Colors.greenMuted,
  },
  btnSecondaryText: { color: Colors.green, fontWeight: '700', fontSize: 14 },
  scanHelp: { color: Colors.textSecondary, fontSize: 13, marginBottom: 10, lineHeight: 18 },
  scanFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgInput,
  },
});
