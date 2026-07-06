import assert from 'node:assert/strict';
import { isRetryableFetchError } from '../lib/fetchWithTimeout';
import { looksLikeHttpUrl, stripStageStockServerRootSuffix } from '../lib/httpUrlUtils';

function testRetryableErrors() {
  assert.equal(isRetryableFetchError(new Error('Network request failed')), true);
  assert.equal(isRetryableFetchError(Object.assign(new Error('aborted'), { name: 'AbortError' })), true);
  assert.equal(isRetryableFetchError(new Error('validation failed')), false);
}

function testStripApiSuffix() {
  assert.equal(stripStageStockServerRootSuffix('http://192.168.1.5:8091/api'), 'http://192.168.1.5:8091');
  assert.equal(stripStageStockServerRootSuffix('http://10.0.0.2:8091/pair'), 'http://10.0.0.2:8091');
}

function testLooksLikeHttpUrl() {
  assert.equal(looksLikeHttpUrl('192.168.0.5:8091'), true);
  assert.equal(looksLikeHttpUrl(''), false);
}

testRetryableErrors();
testStripApiSuffix();
testLooksLikeHttpUrl();
console.log('fetch-http-utils.spec: OK');
