import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { updateAppUserExpoPushToken } from '../db/database';
import type { AppUser } from '../types';

/** Enregistre le jeton push sur le compte (admin, technicien, emprunteur) pour les notifications. */
export async function registerStaffExpoPushToken(user: AppUser): Promise<void> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId || typeof projectId !== 'string') return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;
    await updateAppUserExpoPushToken(user.id, token);
  } catch {
    /* optionnel — ne pas bloquer la connexion */
  }
}
