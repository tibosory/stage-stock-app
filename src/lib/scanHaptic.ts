import * as Haptics from 'expo-haptics';
import { getComfortPrefsCached } from './appComfortPrefs';

/** Appelé quand un scan a reconnu une fiche (pas pour « code inconnu »). */
export async function triggerScanMatchHaptic(): Promise<void> {
  try {
    const p = await getComfortPrefsCached();
    if (!p.hapticOnScanMatch) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    /* appareil sans haptique ou préf indisponible */
  }
}
