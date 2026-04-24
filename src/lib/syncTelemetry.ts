import AsyncStorage from '@react-native-async-storage/async-storage';

export type SyncBackend = 'api' | 'supabase';
export type SyncDirection = 'push' | 'pull';
export type SyncStatus = 'ok' | 'error' | 'skipped';

export type SyncStamp = {
  at: string;
  status: SyncStatus;
  message?: string;
};

export type SyncTelemetry = {
  api: { push?: SyncStamp; pull?: SyncStamp };
  supabase: { push?: SyncStamp; pull?: SyncStamp };
};

const STORAGE_KEY = 'stagestock_sync_telemetry_v1';

const EMPTY: SyncTelemetry = {
  api: {},
  supabase: {},
};

export async function loadSyncTelemetry(): Promise<SyncTelemetry> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<SyncTelemetry>;
    return {
      api: {
        push: parsed.api?.push,
        pull: parsed.api?.pull,
      },
      supabase: {
        push: parsed.supabase?.push,
        pull: parsed.supabase?.pull,
      },
    };
  } catch {
    return EMPTY;
  }
}

export async function recordSyncTelemetry(
  backend: SyncBackend,
  direction: SyncDirection,
  status: SyncStatus,
  message?: string
): Promise<void> {
  const current = await loadSyncTelemetry();
  const next: SyncTelemetry = {
    ...current,
    [backend]: {
      ...current[backend],
      [direction]: {
        at: new Date().toISOString(),
        status,
        message: message?.trim() ? message.trim().slice(0, 240) : undefined,
      },
    },
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

