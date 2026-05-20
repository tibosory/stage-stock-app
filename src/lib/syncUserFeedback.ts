import { Alert } from 'react-native';

let lastNotifyAt = 0;
const MIN_MS_BETWEEN_ALERTS = 45_000;

/** Alerte utilisateur non bloquante après échec sync foreground (anti-spam). */
export function notifyForegroundSyncIssue(title: string, body: string): void {
  const now = Date.now();
  if (lastNotifyAt > 0 && now - lastNotifyAt < MIN_MS_BETWEEN_ALERTS) return;
  lastNotifyAt = now;
  Alert.alert(title, body, [{ text: 'OK' }]);
}
