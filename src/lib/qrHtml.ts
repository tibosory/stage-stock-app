// Génération QR embarquée (sans réseau) pour inclusion dans HTML / PDF
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-generator') as (
  typeNumber: number,
  errorCorrectionLevel: string
) => {
  addData: (s: string) => void;
  make: () => void;
  createImgTag: (cellSize?: number, margin?: number) => string;
};

export function qrCodeImgTagForHtml(payload: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  return qr.createImgTag(5, 2);
}
