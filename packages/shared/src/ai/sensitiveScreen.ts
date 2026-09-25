import Anthropic from "@anthropic-ai/sdk";

/**
 * Colleague Experience's real-time safety check — spec: "does this appear
 * to be about a specific senior person — the HR head or above? This
 * happens before anyone at the company sees anything." Deliberately a
 * separate, cheap, single-purpose classifier from generateTriageSuggestion
 * (ai/triage.ts): that one assigns a category and only runs when an Alert
 * Rule has already fired, which is exactly the gap here — a one-off HR/
 * leadership complaint that never crosses a configured threshold must
 * still be caught, so this has to run on every Colleague Experience
 * response with an open comment, unconditionally, not gated on alert
 * firing. One short yes/no classification call, not the full triage +
 * root-cause pipeline — keeps this fast enough to sit in the synchronous
 * submit path for every response.
 *
 * Gated behind ANTHROPIC_API_KEY like every other AI call in this codebase
 * — fails closed to "not sensitive" when the key is missing or the call
 * errors, since the normal category-based sensitive-routing path (see
 * alerts/evaluate.ts's autoTriageAndCreateActionItem) still catches it if
 * that same comment ever triggers an alert.
 */
export async function screenForSensitiveComment(comment: string): Promise<boolean> {
  const trimmed = comment.trim();
  if (!trimmed) return false;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return false;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      system:
        "You read one anonymous workplace-feedback comment. Answer only 'yes' or 'no', nothing else: " +
        "does this comment describe, complain about, or concern a specific senior leader, executive, or the HR " +
        "department itself (as opposed to a general workplace issue, a peer, or a direct manager)?",
      messages: [{ role: "user", content: trimmed }],
    });

    const text = message.content.find((block) => block.type === "text")?.text.trim().toLowerCase() ?? "";
    return text.startsWith("yes");
  } catch (err) {
    console.error("[sensitive-screen] Claude call failed, defaulting to not-sensitive", err);
    return false;
  }
}
