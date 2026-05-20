import assert from 'node:assert/strict';
import {
  normalizeEmailOrNull,
  normalizePushTokenOrNull,
  uniqueNormalizedEmails,
} from '../db/userDbQuery';

function testNormalizeEmailOrNull() {
  assert.equal(normalizeEmailOrNull('  ADMIN@Example.COM  '), 'admin@example.com');
  assert.equal(normalizeEmailOrNull('invalid-email'), null);
  assert.equal(normalizeEmailOrNull('   '), null);
}

function testUniqueNormalizedEmails() {
  const emails = uniqueNormalizedEmails([
    ' Admin@Example.com ',
    'admin@example.com',
    'tech@example.com',
    null,
    'not-an-email',
  ]);
  assert.deepEqual(emails, ['admin@example.com', 'tech@example.com']);
}

function testNormalizePushTokenOrNull() {
  assert.equal(normalizePushTokenOrNull(' ExponentPushToken[abc] '), 'ExponentPushToken[abc]');
  assert.equal(normalizePushTokenOrNull('   '), null);
  assert.equal(normalizePushTokenOrNull(undefined), null);
}

function run() {
  testNormalizeEmailOrNull();
  testUniqueNormalizedEmails();
  testNormalizePushTokenOrNull();
  console.log('user-db-query.spec: OK');
}

run();
