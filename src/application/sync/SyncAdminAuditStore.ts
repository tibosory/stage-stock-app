import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'stagestock_sync_admin_audit_v1';
const MAX_ENTRIES = 200;

export type SyncAdminAuditEntry = {
  id: string;
  action: 'force_sync' | 'purge_queue' | 'export_diagnostics';
  at: string;
  userId?: string | null;
  summary?: string;
};

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getSyncAdminAuditEntries(): Promise<SyncAdminAuditEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SyncAdminAuditEntry[]) : [];
  } catch {
    return [];
  }
}

export async function appendSyncAdminAuditEntry(input: Omit<SyncAdminAuditEntry, 'id' | 'at'>): Promise<void> {
  const prev = await getSyncAdminAuditEntries();
  const next: SyncAdminAuditEntry[] = [
    {
      id: genId(),
      at: new Date().toISOString(),
      ...input,
    },
    ...prev,
  ].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
