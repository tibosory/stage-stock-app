export type SyncErrorCategory = 'network' | 'auth' | 'timeout' | 'validation' | 'unknown';

export type ClassifiedSyncError = {
  category: SyncErrorCategory;
  code: string;
  message: string;
};

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? 'Unknown sync error');
}

export function classifySyncError(error: unknown): ClassifiedSyncError {
  const msg = toMessage(error).toLowerCase();
  if (
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('failed to fetch') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused')
  ) {
    return { category: 'network', code: 'SYNC_NETWORK', message: toMessage(error) };
  }
  if (
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('jwt') ||
    msg.includes('token')
  ) {
    return { category: 'auth', code: 'SYNC_AUTH', message: toMessage(error) };
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return { category: 'timeout', code: 'SYNC_TIMEOUT', message: toMessage(error) };
  }
  if (msg.includes('validation') || msg.includes('invalid')) {
    return { category: 'validation', code: 'SYNC_VALIDATION', message: toMessage(error) };
  }
  return { category: 'unknown', code: 'SYNC_UNKNOWN', message: toMessage(error) };
}
