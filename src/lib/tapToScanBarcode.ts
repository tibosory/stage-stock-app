import type { BarcodeScanningResult } from 'expo-camera';

type Rect = { left: number; top: number; right: number; bottom: number };

function getBarcodeRect(result: BarcodeScanningResult): Rect | null {
  const { bounds, cornerPoints } = result;
  if (cornerPoints && cornerPoints.length >= 3) {
    const xs = cornerPoints.map(p => p.x);
    const ys = cornerPoints.map(p => p.y);
    return {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
    };
  }
  if (bounds?.origin && bounds?.size && bounds.size.width > 0 && bounds.size.height > 0) {
    return {
      left: bounds.origin.x,
      top: bounds.origin.y,
      right: bounds.origin.x + bounds.size.width,
      bottom: bounds.origin.y + bounds.size.height,
    };
  }
  return null;
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function rectArea(rect: Rect): number {
  return Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
}

function distanceToCenter(x: number, y: number, rect: Rect): number {
  const cx = (rect.left + rect.right) / 2;
  const cy = (rect.top + rect.bottom) / 2;
  return (cx - x) ** 2 + (cy - y) ** 2;
}

/** Choisit le code le plus pertinent sous le doigt (zone la plus petite si chevauchement, sinon le plus proche). */
export function pickBarcodeAtTap(
  barcodes: BarcodeScanningResult[],
  tapX: number,
  tapY: number
): BarcodeScanningResult | null {
  if (barcodes.length === 0) return null;

  const withRects = barcodes
    .map(barcode => ({ barcode, rect: getBarcodeRect(barcode) }))
    .filter((entry): entry is { barcode: BarcodeScanningResult; rect: Rect } => entry.rect !== null);

  const containing = withRects.filter(({ rect }) => pointInRect(tapX, tapY, rect));
  if (containing.length > 0) {
    containing.sort((a, b) => rectArea(a.rect) - rectArea(b.rect));
    return containing[0].barcode;
  }

  if (withRects.length > 0) {
    withRects.sort((a, b) => distanceToCenter(tapX, tapY, a.rect) - distanceToCenter(tapX, tapY, b.rect));
    return withRects[0].barcode;
  }

  if (barcodes.length === 1) return barcodes[0];
  return null;
}

export function rememberDetectedBarcode(
  store: Map<string, BarcodeScanningResult>,
  result: BarcodeScanningResult
): void {
  const key = result.data?.trim() ?? result.data;
  if (!key) return;
  store.set(key, result);
}
