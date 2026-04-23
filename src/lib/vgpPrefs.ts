import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vgp_notification_advance_days';

const DEFAULT_DAYS = 7;
const MIN = 0;
const MAX = 90;

export function clampVgpAdvanceDays(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DAYS;
  return Math.min(MAX, Math.max(MIN, Math.round(n)));
}

export async function getVgpNotificationAdvanceDays(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw == null || raw === '') return DEFAULT_DAYS;
    return clampVgpAdvanceDays(parseInt(raw, 10));
  } catch {
    return DEFAULT_DAYS;
  }
}

export async function setVgpNotificationAdvanceDays(days: number): Promise<void> {
  await AsyncStorage.setItem(KEY, String(clampVgpAdvanceDays(days)));
}
