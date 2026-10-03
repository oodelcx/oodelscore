import { RateLimitHit } from "../models/RateLimitHit";

/**
 * Fixed-window rate limiter backed by Mongo (no Redis/queue in this stack).
 * Buckets requests into `windowSeconds`-wide windows aligned to the epoch,
 * so concurrent callers sharing a window increment the same document —
 * the (key, windowStart) unique index on RateLimitHit makes the
 * upsert-and-increment atomic even under a burst of simultaneous requests.
 */
export async function checkRateLimit(
  key: string,
  limitPerWindow: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  let count: number;
  try {
    const hit = await RateLimitHit.findOneAndUpdate(
      { key, windowStart },
      { $inc: { count: 1 } },
      { upsert: true, new: true }
    );
    count = hit.count;
  } catch {
    // Two requests racing to create the same (key, windowStart) doc can hit
    // a duplicate-key error on the unique index — the loser just retries
    // the update, which now finds the winner's doc.
    const hit = await RateLimitHit.findOneAndUpdate({ key, windowStart }, { $inc: { count: 1 } }, { upsert: true, new: true });
    count = hit.count;
  }

  return { allowed: count <= limitPerWindow, remaining: Math.max(0, limitPerWindow - count) };
}

/**
 * Best-effort client IP from standard proxy headers (Render, like most
 * PaaS, sits behind a proxy that sets x-forwarded-for). Falls back to a
 * constant so requests without any forwarded header still share one
 * (coarser, but non-zero) rate-limit bucket instead of bypassing limiting
 * entirely.
 */
export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
