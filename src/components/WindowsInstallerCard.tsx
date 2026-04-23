import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, Alert, ActivityIndicator } from 'react-native';
import { Colors, Shadow } from '../theme/colors';
import { Card } from './UI';
import { resolveWindowsServerInstallerUrl, type WindowsInstallerResolved } from '../config/installerUrls';

/**
 * Android uniquement : téléchargement de l’installateur serveur local Windows (PocketBase + scripts).
 */
export function WindowsInstallerCard() {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<WindowsInstallerResolved | null>(null);

  const onPress = useCallback(async () => {
    setBusy(true);
    try {
      const resolved = await resolveWindowsServerInstallerUrl();
      setInfo(resolved);
      const url = resolved.url;
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        Alert.alert('Ouverture impossible', `URL : ${url}`);
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  if (Platform.OS !== 'android') return null;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Serveur sur votre PC (Windows)</Text>
      <Text style={styles.hint}>
        Téléchargez l’installateur, exécutez-le sur un PC Windows 10/11 (même Wi‑Fi que ce téléphone). Au premier
        lancement : PocketBase sur le port 8090, IA locale via Ollama (mistral), QR code et URL affichés sur le PC.
        Ensuite scannez le QR de jumelage (ou ouvrez http://IP_DU_PC:8090/pair) pour connecter automatiquement l’app.
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
});
