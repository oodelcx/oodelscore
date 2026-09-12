import type { DeviceType } from "../models/Response";

/** Coarse device classification from a User-Agent string — good enough for
 * the "what devices scan our QR codes" analytics; not meant as a precise
 * client-detection library. */
export function classifyDevice(userAgent: string | null): DeviceType {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|playbook|silk/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android/.test(ua)) return "mobile";
  if (/mozilla|windows|macintosh|linux|x11/.test(ua)) return "desktop";
  return "unknown";
}
