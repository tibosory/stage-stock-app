import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

const KEY = 'stagestock_workspace_onboarding_v1_done';
const KEY_INSTALL_MARKER = 'stagestock_workspace_onboarding_v1_install_marker';
/** Connexion serveur PC validée (ping OK ou jumelage QR). Recommandée, non bloquante pour l’accès à l’app. */
const KEY_SERVER_PAIRING = 'stagestock_server_pairing_v1_verified';

async function getCurrentInstallMarker(): Promise<string> {
  try {
    const installedAt = await Application.getInstallationTimeAsync();
    if (installedAt) return `install:${installedAt.getTime()}`;
  } catch {
    // no-op
  }
  const nativeVersion = Application.nativeBuildVersion?.trim();
  if (nativeVersion) return `build:${nativeVersion}`;
  return 'unknown';
}

/**
 * L’utilisateur a terminé (ou ignoré) l’assistant de préconfiguration.
 * N’est affiché qu’une fois par installation, jusqu’à reset des données de l’app.
 */
export async function hasCompletedWorkspaceOnboarding(): Promise<boolean> {
  try {
    const [done, savedInstallMarker, currentInstallMarker] = await Promise.all([
      AsyncStorage.getItem(KEY),
      AsyncStorage.getItem(KEY_INSTALL_MARKER),
      getCurrentInstallMarker(),
    ]);

    // Première exécution sur cette installation (ou installation détectée différente) => relancer le didacticiel.
    if (!savedInstallMarker || savedInstallMarker !== currentInstallMarker) {
      await AsyncStorage.setItem(KEY_INSTALL_MARKER, currentInstallMarker);
      if (savedInstallMarker && savedInstallMarker !== currentInstallMarker) {
        await AsyncStorage.removeItem(KEY);
      }
      return false;
    }

    return done === '1';
  } catch {
    return false;
  }
}

export async function setWorkspaceOnboardingCompleted(): Promise<void> {
  const marker = await getCurrentInstallMarker();
  await AsyncStorage.multiSet([
    [KEY, '1'],
    [KEY_INSTALL_MARKER, marker],
  ]);
}

/** Serveur local jumelé et joignable (ping OK en onboarding ou via QR). */
export async function hasVerifiedServerPairing(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_SERVER_PAIRING)) === '1';
  } catch {
    return false;
  }
}

export async function setServerPairingVerified(): Promise<void> {
  await AsyncStorage.setItem(KEY_SERVER_PAIRING, '1');
}

export async function resetServerPairingVerified(): Promise<void> {
  await AsyncStorage.removeItem(KEY_SERVER_PAIRING);
}

/** Force la réapparition de l’assistant au prochain affichage de la navigation connectée. */
export async function resetWorkspaceOnboardingCompleted(): Promise<void> {
  await AsyncStorage.multiRemove([KEY, KEY_SERVER_PAIRING]);
}
