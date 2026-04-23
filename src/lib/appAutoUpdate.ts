/**
 * Mises à jour automatiques : Expo Updates (OTA JS) si activé en prod.
 * (Pas de téléchargement d’APK / installateur depuis une URL serveur — désactivé.)
 */
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

const STORAGE_LAST_CHECK_MS = '@stagestock_auto_update_last_check';

/** Intervalle minimum entre deux vérifications complètes (réveil + timer). */
const MIN_CHECK_GAP_MS = 15 * 60 * 1000;
/** Intervalle timer (en plus des contrôles au premier plan). */
export const AUTO_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

let cycleRunning = false;

async function maybeFetchOtaBundle(): Promise<void> {
  if (__DEV__) return;
  if (!Updates.isEnabled) return;
  try {
    const r = await Updates.checkForUpdateAsync();
    if (r.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // réseau / pas de build EAS — ignoré
  }
}

/**
 * Vérifie les mises à jour OTA (Expo). Sans dialogue utilisateur dans l’app.
 */
export async function runAutoUpdateCycle(): Promise<void> {
  if (cycleRunning) return;
  cycleRunning = true;
  try {
    const now = Date.now();
    const prev = await AsyncStorage.getItem(STORAGE_LAST_CHECK_MS);
    if (prev && now - Number(prev) < MIN_CHECK_GAP_MS) return;
    await AsyncStorage.setItem(STORAGE_LAST_CHECK_MS, String(now));

    await maybeFetchOtaBundle();
  } catch {
    /* silencieux */
  } finally {
    cycleRunning = false;
  }
}

/**
 * Hook : démarrage + retour au premier plan + intervalle horaire.
 */
export function subscribeAutoUpdateChecks(): () => void {
  const tick = () => {
    runAutoUpdateCycle().catch(() => {});
  };

  tick();
  const interval = setInterval(tick, AUTO_UPDATE_INTERVAL_MS);
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active') tick();
  });

  return () => {
    clearInterval(interval);
    sub.remove();
  };
}
