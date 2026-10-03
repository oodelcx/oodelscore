import { SystemHealthEvent, type SystemHealthEventType } from "../models/SystemHealthEvent";

/**
 * Fire-and-forget: a failure logging its own failure must never mask or
 * throw over the original error. Callers await this for ordering, but a
 * write failure here is swallowed, not surfaced.
 */
export async function logSystemHealthEvent(
  type: SystemHealthEventType,
  message: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  try {
    await SystemHealthEvent.create({ type, message, context, occurredAt: new Date() });
  } catch (err) {
    console.error("[system-health] failed to record health event", type, err);
  }
}

/**
 * Scoped extension for exposed API routes (Phase 8, P8.6): not a full APM
 * replacement — there's no stack-trace capture, breadcrumbs, or alerting
 * here, and that's deliberate. This just gets an unhandled route error out
 * of Render's logs and into the product where Admin already looks (Platform
 * Health), for the handful of public/critical routes most likely to fail
 * silently. Always console.error's too, so nothing regresses if this write
 * itself fails.
 */
export async function logApiRouteError(route: string, err: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[api-route-error] ${route}`, err);
  await logSystemHealthEvent("api_route_error", message, { route, ...context });
}
