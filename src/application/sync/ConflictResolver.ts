export type ConflictPolicy = 'prefer_local' | 'prefer_remote';

type Row = Record<string, unknown> & { updated_at?: string; status?: string };

function ts(value?: string): number {
  const n = value ? Date.parse(value) : 0;
  return Number.isFinite(n) ? n : 0;
}

function isTerminalAssignmentStatus(status?: unknown): boolean {
  return status === 'returned' || status === 'lost' || status === 'damaged';
}

export function resolveLww<T extends Row>(localRow: T, remoteRow: T, policy: ConflictPolicy = 'prefer_local'): T {
  const lt = ts(localRow.updated_at);
  const rt = ts(remoteRow.updated_at);

  if (lt === rt) {
    if (policy === 'prefer_remote') return remoteRow;
    return localRow;
  }
  return lt >= rt ? localRow : remoteRow;
}

/**
 * Règle métier tracking: ne jamais écraser un état terminal local
 * par un état non-terminal distant (évite de "ressusciter" un matériel perdu/endommagé).
 */
export function resolveAssignmentConflict<T extends Row>(localRow: T, remoteRow: T): T {
  if (isTerminalAssignmentStatus(localRow.status) && !isTerminalAssignmentStatus(remoteRow.status)) {
    return localRow;
  }
  return resolveLww(localRow, remoteRow, 'prefer_local');
}
