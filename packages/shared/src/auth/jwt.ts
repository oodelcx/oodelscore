import jwt from "jsonwebtoken";
import type { AccountType } from "../models/User";

const SESSION_TTL = "7d";
// Deliberately short — this token only proves "password was correct," not
// "this session is authenticated." It's shown to the browser between the
// password step and the TOTP code step, so it should expire fast.
const PENDING_2FA_TTL = "5m";

export interface SessionPayload {
  sub: string; // users._id
  accountType: AccountType;
  tokenVersion: number;
}

export interface Pending2faPayload {
  sub: string; // users._id
  tokenVersion: number; // pinned at issue time, so a password change mid-flow invalidates it too
  pending2fa: true;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: SESSION_TTL });
}

/** Returns null on any invalid/expired/malformed token rather than throwing. */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret());
    if (typeof decoded !== "object" || decoded === null) return null;
    const { sub, accountType, tokenVersion } = decoded as Record<string, unknown>;
    if (typeof sub !== "string" || typeof accountType !== "string" || typeof tokenVersion !== "number") {
      return null;
    }
    return { sub, accountType: accountType as AccountType, tokenVersion };
  } catch {
    return null;
  }
}

export function signPending2faToken(payload: Omit<Pending2faPayload, "pending2fa">): string {
  return jwt.sign({ ...payload, pending2fa: true }, getSecret(), { expiresIn: PENDING_2FA_TTL });
}

/** Returns null on any invalid/expired/malformed token, or one that isn't a pending-2FA token. */
export function verifyPending2faToken(token: string): Pending2faPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret());
    if (typeof decoded !== "object" || decoded === null) return null;
    const { sub, tokenVersion, pending2fa } = decoded as Record<string, unknown>;
    if (typeof sub !== "string" || typeof tokenVersion !== "number" || pending2fa !== true) return null;
    return { sub, tokenVersion, pending2fa: true };
  } catch {
    return null;
  }
}
