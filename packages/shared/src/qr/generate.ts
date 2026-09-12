import QRCode from "qrcode";

/** PNG bytes encoding `text` — used for a Feedback Point's public QR code. */
export async function generateQrPngBuffer(text: string, size = 512): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}
