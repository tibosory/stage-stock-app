import assert from 'node:assert/strict';
import { classifySyncError } from '../application/sync/SyncErrorClassifier';

function run() {
  const network = classifySyncError(new Error('Network request failed'));
  assert.equal(network.category, 'network');
  assert.equal(network.code, 'SYNC_NETWORK');

  const auth = classifySyncError(new Error('Unauthorized token expired'));
  assert.equal(auth.category, 'auth');
  assert.equal(auth.code, 'SYNC_AUTH');

  const timeout = classifySyncError(new Error('Request timed out after 30s'));
  assert.equal(timeout.category, 'timeout');
  assert.equal(timeout.code, 'SYNC_TIMEOUT');

  const validation = classifySyncError(new Error('Invalid payload validation error'));
  assert.equal(validation.category, 'validation');
  assert.equal(validation.code, 'SYNC_VALIDATION');

  const unknown = classifySyncError(new Error('Some weird failure'));
  assert.equal(unknown.category, 'unknown');
  assert.equal(unknown.code, 'SYNC_UNKNOWN');

  console.log('sync-error-classifier.spec: OK');
}

run();
