// eslint-disable-next-line @typescript-eslint/no-require-imports
const qrcode = require('qrcode-generator') as (
  typeNumber: number,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'
) => {
  addData: (data: string) => void;
  make: () => void;
  getModuleCount: () => number;
  isDark: (row: number, col: number) => boolean;
};

/** SVG compact pour affichage WebView (étiquette / provisioning). */
export function buildQrCodeSvg(text: string, cellSize = 4): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const dim = n * cellSize;
  let path = '';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(row, col)) {
        path += `M${col * cellSize},${row * cellSize}h${cellSize}v${cellSize}h-${cellSize}z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}"><path fill="#111827" d="${path}"/></svg>`;
}

export function buildQrCodePreviewHtml(text: string): string {
  const svg = buildQrCodeSvg(text);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#fff;padding:8px;">${svg}</body></html>`;
}
