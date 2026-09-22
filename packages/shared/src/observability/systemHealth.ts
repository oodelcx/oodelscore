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
