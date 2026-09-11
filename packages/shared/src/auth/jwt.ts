import jwt from "jsonwebtoken";
import type { AccountType } from "../models/User";

const SESSION_TTL = "7d";

export interface SessionPayload {
  sub: string; // users._id
  accountType: AccountType;
  tokenVersion: number;
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
