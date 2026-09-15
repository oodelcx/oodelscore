import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

const ISSUER = "OodelCX";

/** Base32 secret, ready to embed in an otpauth:// URI or verify a code against. */
export function generateTwoFactorSecret(): string {
  return generateSecret();
}

/** Data URL (PNG) of a QR code encoding the otpauth:// URI, for the authenticator app to scan. */
export async function generateTwoFactorQrCode(email: string, secret: string): Promise<string> {
  const uri = generateURI({ issuer: ISSUER, label: email, secret });
  return QRCode.toDataURL(uri);
}

/** True if the 6-digit code matches the secret, allowing the usual +/-1 step clock drift. */
export async function verifyTwoFactorCode(secret: string, token: string): Promise<boolean> {
  if (!/^\d{6}$/.test(token)) return false;
  const result = await verify({ secret, token, epochTolerance: 30 });
  return result.valid;
}
