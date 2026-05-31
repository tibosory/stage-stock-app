export type DiagnosticLevel = 'ok' | 'warn' | 'error';

export type DiagnosticCheckId =
  | 'device_network'
  | 'local_server'
  | 'local_sync'
  | 'api_auth'
  | 'cloud_config'
  | 'cloud_session';

export type DiagnosticCheck = {
  id: DiagnosticCheckId;
  level: DiagnosticLevel;
  detail?: string;
};

export type ConnectionDiagnosticsDeps = {
  getIsOnline: () => boolean;
  getResolvedApiBase: () => Promise<string>;
  checkServerReachableQuick: () => Promise<boolean>;
  pingStageStockApi: () => Promise<{ ok: boolean; message: string }>;
  probeStageStockSyncApi: () => Promise<{ ok: boolean; message: string }>;
  isSupabaseConfigured: () => boolean;
  getSupabaseSession: () => Promise<{ ok: boolean }>;
  hasLocalSyncApiKey: () => Promise<boolean>;
};

export async function runConnectionDiagnostics(
  deps: ConnectionDiagnosticsDeps
): Promise<DiagnosticCheck[]> {
  const out: DiagnosticCheck[] = [];

  const online = deps.getIsOnline();
  out.push({
    id: 'device_network',
    level: online ? 'ok' : 'warn',
    detail: online ? undefined : 'offline',
  });

  const base = (await deps.getResolvedApiBase()).trim();
  if (!base) {
    out.push({ id: 'local_server', level: 'warn', detail: 'no_url' });
    out.push({ id: 'local_sync', level: 'warn', detail: 'no_url' });
    out.push({ id: 'api_auth', level: 'warn', detail: 'no_url' });
  } else {
    let serverLevel: DiagnosticLevel = 'error';
    const quick = await deps.checkServerReachableQuick();
    if (quick) {
      serverLevel = 'ok';
      out.push({ id: 'local_server', level: 'ok' });
    } else {
      const ping = await deps.pingStageStockApi();
      serverLevel = ping.ok ? 'ok' : 'error';
      out.push({
        id: 'local_server',
        level: serverLevel,
        detail: ping.ok ? undefined : ping.message,
      });
    }

    const sync = await deps.probeStageStockSyncApi();
    out.push({
      id: 'local_sync',
      level: sync.ok ? 'ok' : serverLevel === 'ok' ? 'warn' : 'error',
      detail: sync.ok ? undefined : sync.message,
    });

    const hasKey = await deps.hasLocalSyncApiKey();
    const buildKey = Boolean(process.env.EXPO_PUBLIC_API_KEY?.trim());
    out.push({
      id: 'api_auth',
      level: sync.ok || hasKey || buildKey ? 'ok' : 'warn',
      detail: hasKey || buildKey ? undefined : 'no_key',
    });
  }

  const cloudOn = deps.isSupabaseConfigured();
  out.push({
    id: 'cloud_config',
    level: cloudOn ? 'ok' : 'warn',
    detail: cloudOn ? undefined : 'not_configured',
  });

  if (cloudOn) {
    const session = await deps.getSupabaseSession();
    out.push({
      id: 'cloud_session',
      level: session.ok ? 'ok' : 'warn',
      detail: session.ok ? undefined : 'no_session',
    });
  }

  return out;
}
