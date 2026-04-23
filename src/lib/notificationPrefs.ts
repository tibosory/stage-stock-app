import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = '@stagestock_notification_prefs_v1';
const RECIP_KEY = '@stagestock_mail_recipient_alert_ids_v1';

export type NotificationPrefs = {
  pushPrets: boolean;
  /** VGP et contrôles EPI — échéances */
  pushVgpControle: boolean;
  pushSeuilBas: boolean;
  /** Permet le bouton « e-mail d’achat » (seuil bas) et mailto */
  mailSuggestionSeuil: boolean;
  mailSuggestionVgp: boolean;
  mailSuggestionPrets: boolean;
  /** Envoi auto récap. alertes (Wi‑Fi / données) via le serveur si SMTP configuré */
  mailAutoSendWifiCellular: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  pushPrets: true,
  pushVgpControle: true,
  pushSeuilBas: true,
  mailSuggestionSeuil: true,
  mailSuggestionVgp: true,
  mailSuggestionPrets: true,
  mailAutoSendWifiCellular: true,
};

function normalizePrefs(p: Partial<NotificationPrefs> | null | undefined): NotificationPrefs {
  return {
    pushPrets: p?.pushPrets !== false,
    pushVgpControle: p?.pushVgpControle !== false,
    pushSeuilBas: p?.pushSeuilBas !== false,
    mailSuggestionSeuil: p?.mailSuggestionSeuil !== false,
    mailSuggestionVgp: p?.mailSuggestionVgp !== false,
    mailSuggestionPrets: p?.mailSuggestionPrets !== false,
    mailAutoSendWifiCellular: p?.mailAutoSendWifiCellular !== false,
  };
}

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return normalizePrefs(parsed);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function saveNotificationPrefs(partial: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  const cur = await loadNotificationPrefs();
  const next = normalizePrefs({ ...cur, ...partial });
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}

/** Identifiants `alertes_email.id` sélectionnés pour les envois mailto (liste par défaut). */
export async function loadMailRecipientAlerteIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECIP_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

export async function saveMailRecipientAlerteIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(RECIP_KEY, JSON.stringify(ids));
}
