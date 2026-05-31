import assert from 'node:assert/strict';
import { toUserFriendlyNetworkMessage } from '../lib/userFriendlyNetworkError';

function testEconnrefusedFr() {
  const msg = toUserFriendlyNetworkMessage('connect ECONNREFUSED 192.168.1.1:8091', 'fr');
  assert.ok(msg.includes('serveur'), msg);
  assert.ok(!msg.includes('ECONNREFUSED'), msg);
}

function testNetworkErrorEn() {
  const msg = toUserFriendlyNetworkMessage('Network request failed', 'en');
  assert.ok(msg.toLowerCase().includes('offline'), msg);
}

function testTimeoutFr() {
  const msg = toUserFriendlyNetworkMessage('Aborted due to timeout', 'fr');
  assert.ok(msg.includes('temps'), msg);
}

function testTokenExpiredEn() {
  const msg = toUserFriendlyNetworkMessage('Unauthorized token expired', 'en');
  assert.ok(msg.toLowerCase().includes('session'), msg);
}

testEconnrefusedFr();
testNetworkErrorEn();
testTimeoutFr();
testTokenExpiredEn();
console.log('user-friendly-network-error.spec: OK');
