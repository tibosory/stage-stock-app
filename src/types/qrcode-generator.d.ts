declare module 'qrcode-generator' {
  interface QrCode {
    addData: (s: string) => void;
    make: () => void;
    createImgTag: (cellSize?: number, margin?: number) => string;
  }
  function qrcode(typeNumber: number, errorCorrectionLevel: string): QrCode;
  export = qrcode;
}
