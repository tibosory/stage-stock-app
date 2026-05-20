export function normalizeEmailOrNull(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized || !normalized.includes('@')) return null;
  return normalized;
}

export function uniqueNormalizedEmails(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const value of values) {
    const normalized = normalizeEmailOrNull(value);
    if (normalized) set.add(normalized);
  }
  return [...set];
}

export function normalizePushTokenOrNull(value: string | null | undefined): string | null {
  const token = value?.trim() ?? '';
  return token || null;
}
