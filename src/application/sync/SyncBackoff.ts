const MAX_BACKOFF_MS = 5 * 60 * 1000;

export function computeSyncBackoffDelay(baseMs: number, failures: number): number {
  const multiplier = failures <= 0 ? 1 : Math.min(2 ** failures, 16);
  return Math.min(Math.max(10000, baseMs) * multiplier, MAX_BACKOFF_MS);
}
