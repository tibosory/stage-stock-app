import assert from 'node:assert/strict';
import {
  buildSupabaseProvisioningDeepLink,
  parseSupabaseProvisioningDeepLink,
} from '../lib/supabaseProvisioningDeepLink';

function testRoundTrip() {
  const url = 'https://abcd1234.supabase.co';
  const key = 'eyJhbGci.test';
  const link = buildSupabaseProvisioningDeepLink(url, key);
  const parsed = parseSupabaseProvisioningDeepLink(link);
  assert.ok(parsed);
  assert.equal(parsed!.url, url);
  assert.equal(parsed!.anonKey, key);
}

function testRejectNonSupabaseUrl() {
  assert.equal(
    parseSupabaseProvisioningDeepLink(
      buildSupabaseProvisioningDeepLink('http://evil.example.com', 'key')
    ),
    null
  );
}

function testRejectPairLink() {
  assert.equal(parseSupabaseProvisioningDeepLink('stagestock://pair?base=http%3A%2F%2F1.2.3.4'), null);
}

testRoundTrip();
testRejectNonSupabaseUrl();
testRejectPairLink();
console.log('supabase-provisioning-deep-link.spec: OK');
