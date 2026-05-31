import assert from 'node:assert/strict';
import {
  parseHttpPairingTarget,
  parsePairingDeepLink,
  getPairingHostIssue,
  isLoopbackHost,
} from '../lib/pairingDeepLink';

function testDeepLink() {
  const p = parsePairingDeepLink(
    'stagestock://pair?base=http%3A%2F%2F192.168.0.5%3A8091&key=abc'
  );
  assert.ok(p);
  assert.equal(p!.baseUrl, 'http://192.168.0.5:8091');
  assert.equal(p!.apiKey, 'abc');
}

function testHttpPairPage() {
  const p = parseHttpPairingTarget('http://192.168.0.5:8091/pair?key=secret');
  assert.ok(p);
  assert.equal(p!.baseUrl, 'http://192.168.0.5:8091');
  assert.equal(p!.apiKey, 'secret');
}

function testHttpPairPageNoKey() {
  const p = parseHttpPairingTarget('http://10.0.0.2:8091/pair');
  assert.ok(p);
  assert.equal(p!.baseUrl, 'http://10.0.0.2:8091');
  assert.equal(p!.apiKey, null);
}

function testLoopbackHost() {
  assert.equal(getPairingHostIssue('http://127.0.0.1:8091'), 'loopback');
  assert.equal(getPairingHostIssue('http://192.168.1.10:8091'), null);
  assert.ok(isLoopbackHost('127.0.0.1'));
  assert.ok(!isLoopbackHost('192.168.0.5'));
}

testDeepLink();
testHttpPairPage();
testHttpPairPageNoKey();
testLoopbackHost();
console.log('pairing-deep-link.spec: OK');
