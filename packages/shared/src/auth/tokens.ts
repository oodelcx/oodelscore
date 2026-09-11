import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

const INVITE_TOKEN_TTL_DAYS = 7; // spec Section 2/3: invite tokens expire 7 days from send

export interface GeneratedToken {
  /** Raw token — goes in the emailed link, never stored. */
  token: string;
  /** Sha256 hex digest — what actually gets persisted. */
  hash: string;
  expiresAt: Date;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Used for both invite-to-set-password and password-reset links. */
export function generateSetPasswordToken(): GeneratedToken {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash: hashToken(token), expiresAt };
}

export function verifySetPasswordToken(token: string, storedHash: string | null, expiresAt: Date | null): boolean {
  if (!storedHash || !expiresAt) return false;
  if (expiresAt.getTime() < Date.now()) return false;
  const candidateHash = Buffer.from(hashToken(token));
  const stored = Buffer.from(storedHash);
  if (candidateHash.length !== stored.length) return false;
  return timingSafeEqual(candidateHash, stored);
}
