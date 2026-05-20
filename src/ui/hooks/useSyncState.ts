import { useEffect, useState } from 'react';
import { getSyncState, subscribeSyncState, type SyncState } from '../../application/sync/SyncStateStore';

export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>(() => getSyncState());
  useEffect(() => subscribeSyncState(setState), []);
  return state;
}
