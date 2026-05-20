export type SyncPhase = 'idle' | 'running' | 'success' | 'error';

export type SyncState = {
  phase: SyncPhase;
  schedulerActive?: boolean;
  nextScheduledAt?: string;
  nextBackoffMs?: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorCode?: string;
  lastErrorCategory?: 'network' | 'auth' | 'timeout' | 'validation' | 'unknown';
  lastErrorMessage?: string;
  consecutiveFailures: number;
};

type Listener = (state: SyncState) => void;

let state: SyncState = {
  phase: 'idle',
  consecutiveFailures: 0,
};

const listeners = new Set<Listener>();

export function getSyncState(): SyncState {
  return state;
}

export function setSyncState(next: Partial<SyncState>): SyncState {
  state = { ...state, ...next };
  for (const listener of listeners) {
    listener(state);
  }
  return state;
}

export function subscribeSyncState(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}
