import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Colors, Shadow } from '../theme/colors';
import { Card, Input, BottomModal } from './UI';
import { resolveWindowsServerInstallerUrl, type WindowsInstallerResolved } from '../config/installerUrls';
import { useLanguage } from '../context/LanguageContext';

/**
 * Android uniquement : téléchargement de l’installateur serveur local Windows (backend CATRACK Pro).
 */
export function WindowsInstallerCard() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const tr = useCallback(
    (fr: string, en: string) => (isEn ? en : fr),
    [isEn]
  );
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
      throw new Error(tr('Cache indisponible sur cet appareil.', 'Cache is unavailable on this device.'));
    }
    const resolved = await resolveWindowsServerInstallerUrl();
    setInfo(resolved);
    if (!resolved.url?.trim()) {
      throw new Error(
        tr(
          "Aucun URL d'installateur résolu automatiquement : définissez EXPO_PUBLIC_WINDOWS_INSTALLER_URL au build, ou expo.extra (windowsInstallerUrl / installerGitHubRepo) dans app.json, puis regénérez l'APK. Vous pouvez envoyer l'EXE via le PC (champ /upload) ci-dessous.",
          "No installer URL was resolved automatically: define EXPO_PUBLIC_WINDOWS_INSTALLER_URL at build time, or expo.extra (windowsInstallerUrl / installerGitHubRepo) in app.json, then rebuild the APK. You can also send the EXE via PC upload (/upload) below."
        )
      );
    }
    const target = `${cacheBase}Stagestock-Installer.exe`;
    await FileSystem.deleteAsync(target, { idempotent: true });
    let dl: FileSystem.FileSystemDownloadResult;
    try {
      dl = await FileSystem.downloadAsync(resolved.url, target);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        tr(
          `Impossible de télécharger l’installateur (réseau ou DNS). Vérifiez le Wi‑Fi / Internet du téléphone, puis réessayez.\n\n${msg}`,
          `Cannot download the installer (network or DNS). Check phone Wi‑Fi / Internet, then retry.\n\n${msg}`
        )
      );
    }
    if (dl.status < 200 || dl.status >= 300) {
      if (dl.status === 404) {
        throw new Error(
          tr(
            "Fichier introuvable (404) : aucune release GitHub ne contient un installateur serveur Windows (.exe) à cette URL, ou l'URL personnalisée (app) est erronée. Publiez le build (tag v... sur le depot) ou hebergez l'EXE ailleurs et indiquez extra.windowsInstallerUrl (ou EXPO_PUBLIC_WINDOWS_INSTALLER_URL). ",
            'File not found (404): no GitHub release contains a Windows server installer (.exe) at this URL, or the custom app URL is incorrect. Publish the build (v... tag) or host the EXE elsewhere and set extra.windowsInstallerUrl (or EXPO_PUBLIC_WINDOWS_INSTALLER_URL). '
          ) + `URL: ${resolved.url}`
        );
      }
      throw new Error(tr('Telechargement echoue', 'Download failed') + ` (HTTP ${dl.status}). ${resolved.url}`);
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
          dialogTitle: tr('Envoyer Stagestock-Installer.exe vers le PC', 'Send Stagestock-Installer.exe to PC'),
        });
        return;
      }
      const url = resolved.url;
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      } else {
        Alert.alert(tr('Partage impossible', 'Share unavailable'), `URL: ${url}`);
      }
    } catch (e) {
      Alert.alert(tr('Erreur', 'Error'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [downloadInstallerToCache, tr]);

  const onSendToPc = useCallback(async () => {
    const target = normalizeReceiverUploadUrl(receiverUploadUrl);
    if (!target) {
      Alert.alert(
        tr('URL PC requise', 'PC URL required'),
        tr(
          'Lancez le script Receive-Installer.ps1 sur le PC puis collez l’URL /upload affichee.',
          'Run Receive-Installer.ps1 on the PC, then paste the displayed /upload URL.'
        )
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
        tr('Transfert termine', 'Transfer completed'),
        tr(
          "Le fichier a ete envoye au PC. Lancez ensuite l'EXE depuis le dossier de reception.",
          'The file was sent to the PC. Then run the EXE from the destination folder.'
        )
      );
    } catch (e) {
      Alert.alert(tr('Erreur transfert', 'Transfer error'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [downloadInstallerToCache, normalizeReceiverUploadUrl, receiverUploadUrl, tr]);

  const onOpenQrScan = useCallback(async () => {
    if (!camPerm?.granted) {
      const req = await requestCamPerm();
      if (!req.granted) {
        Alert.alert(
          tr('Camera requise', 'Camera required'),
          tr('Autorisez la camera pour scanner le QR du PC.', 'Allow camera access to scan the PC QR code.')
        );
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
        tr('QR non reconnu', 'Unrecognized QR'),
        tr(
          "Ce QR ne contient pas une URL /upload pour le transfert d'installateur.",
          'This QR does not contain a /upload URL for installer transfer.'
        )
      );
      setTimeout(() => setScanLocked(false), 800);
    },
    [normalizeReceiverUploadUrl, scanLocked]
  );

  if (Platform.OS !== 'android') return null;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{tr('Serveur sur votre PC (Windows)', 'Server on your PC (Windows)')}</Text>
      <Text style={styles.hint}>
        {tr(
          "Methode simple : appuyez ci-dessous. Le fichier se prepare puis le menu Partager s'ouvre. Choisissez comment l'envoyer vers le PC (Bluetooth, Drive, e-mail, cle USB...). Sur le PC, double-cliquez l'installateur EXE puis ouvrez StageStock et scannez le QR affiche.",
          'Simple method: tap below. The file is prepared, then the Share menu opens. Choose how to send it to your PC (Bluetooth, Drive, e-mail, USB key...). On the PC, double-click the installer EXE, open StageStock, and scan the displayed QR code.'
        )}
      </Text>
      {info ? (
        <View style={styles.metaBox}>
          <Text style={styles.metaText}>
            {info.appVersion ? `APK ${info.appVersion}` : tr('APK (version non lue)', 'APK (version unread)')} {'->'}{' '}
            {info.source === 'version-matched'
              ? tr(`installateur compatible (${info.releaseTag ?? 'release'})`, `compatible installer (${info.releaseTag ?? 'release'})`)
              : info.source === 'custom'
                ? tr('installateur personnalise (config build)', 'custom installer (build config)')
                : tr('installateur latest (fallback)', 'latest installer (fallback)')}
          </Text>
        </View>
      ) : null}
      <TouchableOpacity style={styles.btn} onPress={onPress} disabled={busy} activeOpacity={0.85}>
        {busy ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.btnText}>{tr('Installer le serveur sur PC', 'Install server on PC')}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.advancedToggle}
        onPress={() => setShowAdvanced(v => !v)}
        activeOpacity={0.85}
      >
        <Text style={styles.advancedToggleText}>
          {showAdvanced
            ? tr('Masquer options avancees', 'Hide advanced options')
            : tr('Options avancees (technicien)', 'Advanced options (technician)')}
        </Text>
      </TouchableOpacity>
      {showAdvanced ? (
        <View style={styles.advancedBox}>
          <Text style={styles.advancedHint}>
            {tr(
              "Envoi direct vers PC : lancez sur le PC le script `Receive-Installer.ps1`, puis collez ici l'URL `/upload?...` affichee.",
              'Direct send to PC: run `Receive-Installer.ps1` on the PC, then paste the displayed `/upload?...` URL here.'
            )}
          </Text>
          <Input
            label={tr('URL de reception PC (/upload...)', 'PC receiver URL (/upload...)')}
            value={receiverUploadUrl}
            onChangeText={setReceiverUploadUrl}
            placeholder="ex. http://192.168.1.40:8765/upload?token=..."
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity onPress={() => void onOpenQrScan()} style={styles.linkScan} activeOpacity={0.85}>
            <Text style={styles.linkScanText}>{tr('Scanner QR du PC', 'Scan PC QR')}</Text>
          </TouchableOpacity>
          {scanSuccessHintVisible ? (
            <View style={styles.scanOkPill}>
              <Text style={styles.scanOkText}>
                {tr('✅ URL remplie automatiquement', '✅ URL filled automatically')}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.btnSecondary} onPress={onSendToPc} disabled={busy} activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color={Colors.green} />
            ) : (
              <Text style={styles.btnSecondaryText}>
                {tr('Telecharger puis envoyer au PC', 'Download then send to PC')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
      <BottomModal visible={scanOpen} onClose={() => setScanOpen(false)} title={tr('Scanner le QR du PC', 'Scan PC QR')}>
        <Text style={styles.scanHelp}>
          {tr(
            'Pointez la camera vers le QR affiche sur le PC (script Receive-Installer.ps1).',
            'Point the camera at the QR shown on the PC (Receive-Installer.ps1 script).'
          )}
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
