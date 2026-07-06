import assert from 'node:assert/strict';
import { runConnectionDiagnostics, type ConnectionDiagnosticsDeps } from '../lib/connectionDiagnosticsCore';

function mockDeps(overrides: Partial<ConnectionDiagnosticsDeps>): ConnectionDiagnosticsDeps {
  return {
    getIsOnline: () => true,
    getResolvedApiBase: async () => '',
    checkServerReachableQuick: async () => false,
    pingStageStockApi: async () => ({ ok: false, message: 'ECONNREFUSED' }),
    probeStageStockSyncApi: async () => ({ ok: false, message: 'fail' }),
    isSupabaseConfigured: () => false,
    getSupabaseSession: async () => ({ ok: false }),
    hasLocalSyncApiKey: async () => false,
    ...overrides,
  };
}

async function testOfflineDevice() {
  const checks = await runConnectionDiagnostics(mockDeps({ getIsOnline: () => false }));
  const net = checks.find(c => c.id === 'device_network');
  assert.equal(net?.level, 'warn');
}

async function testNoUrlWarns() {
  const checks = await runConnectionDiagnostics(mockDeps({}));
  assert.ok(checks.some(c => c.id === 'local_server' && c.level === 'warn'));
}

async function testServerOk() {
  const checks = await runConnectionDiagnostics(
    mockDeps({
      getResolvedApiBase: async () => 'http://192.168.1.10:8091',
      checkServerReachableQuick: async () => true,
      probeStageStockSyncApi: async () => ({ ok: true, message: 'ok' }),
      hasLocalSyncApiKey: async () => true,
    })
  );
  assert.equal(checks.find(c => c.id === 'local_server')?.level, 'ok');
  assert.equal(checks.find(c => c.id === 'local_sync')?.level, 'ok');
}

async function testSyncPending() {
  const checks = await runConnectionDiagnostics(
    mockDeps({
      getInventorySyncHealth: async () => ({ hasPendingWork: true, detail: '2 mat., 1 cons.' }),
    })
  );
  const pending = checks.find(c => c.id === 'sync_pending');
  assert.equal(pending?.level, 'warn');
  assert.equal(pending?.detail, '2 mat., 1 cons.');
}

void (async () => {
  await testOfflineDevice();
  await testNoUrlWarns();
  await testServerOk();
  await testSyncPending();
  console.log('connection-diagnostics.spec: OK');
})();
