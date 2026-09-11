import { cookies } from "next/headers";
import { connectToDatabase, User, verifySessionToken, type IUser } from "@oodelscore/shared";
import type { HydratedDocument } from "mongoose";

export const SESSION_COOKIE_NAME = "oodel_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days, matches JWT expiry

/**
 * Resolves the current request's session cookie to a live User document, or
 * null if there's no cookie, the JWT is invalid/expired, the user no longer
 * exists, or the token's embedded tokenVersion is stale (password changed
 * since the token was issued — spec Section 3).
 */
export async function getCurrentUser(): Promise<HydratedDocument<IUser> | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  await connectToDatabase();
  const user = await User.findById(payload.sub);
  if (!user) return null;
  if (user.tokenVersion !== payload.tokenVersion) return null;

  return user;
}
