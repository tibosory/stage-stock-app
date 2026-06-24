import assert from 'node:assert/strict';
import type { BarcodeScanningResult } from 'expo-camera';
import { pickBarcodeAtTap } from '../lib/tapToScanBarcode';

function makeResult(data: string, rect: { left: number; top: number; right: number; bottom: number }): BarcodeScanningResult {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  return {
    type: 'qr',
    data,
    bounds: {
      origin: { x: rect.left, y: rect.top },
      size: { width, height },
    },
    cornerPoints: [
      { x: rect.left, y: rect.top },
      { x: rect.right, y: rect.top },
      { x: rect.right, y: rect.bottom },
      { x: rect.left, y: rect.bottom },
    ],
  };
}

function testPickInsideSmallest() {
  const large = makeResult('A', { left: 0, top: 0, right: 200, bottom: 200 });
  const small = makeResult('B', { left: 80, top: 80, right: 120, bottom: 120 });
  const picked = pickBarcodeAtTap([large, small], 100, 100);
  assert.equal(picked?.data, 'B');
}

function testPickClosestWhenOutside() {
  const left = makeResult('L', { left: 10, top: 10, right: 50, bottom: 50 });
  const right = makeResult('R', { left: 150, top: 10, right: 190, bottom: 50 });
  const picked = pickBarcodeAtTap([left, right], 170, 30);
  assert.equal(picked?.data, 'R');
}

function testSingleWithoutBounds() {
  const lone: BarcodeScanningResult = { type: 'qr', data: 'solo', bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } }, cornerPoints: [] };
  const picked = pickBarcodeAtTap([lone], 999, 999);
  assert.equal(picked?.data, 'solo');
}

function testEmptyReturnsNull() {
  assert.equal(pickBarcodeAtTap([], 10, 10), null);
}

testPickInsideSmallest();
testPickClosestWhenOutside();
testSingleWithoutBounds();
testEmptyReturnsNull();
console.log('tap-to-scan-barcode.spec.ts OK');
