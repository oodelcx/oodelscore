import Anthropic from "@anthropic-ai/sdk";

/**
 * Feeds the "negative_sentiment" Alert Rule type: unlike fixed_threshold/
 * nps_floor (which fire off a numeric score), this fires purely off what a
 * respondent actually wrote in an open-text answer — a 4-star rating with a
 * scathing comment would never trip a star-based rule, but should still
 * surface. Uses Claude Haiku 4.5 (the same model/cost tier as the triage
 * module) since this is a simple classification task, not open-ended
 * reasoning.
 *
 * Gated behind ANTHROPIC_API_KEY: falls back to a rough keyword heuristic
 * when it's not set, so a business that turns this rule on without an AI
 * key configured still gets *something* rather than a rule that silently
 * never fires — but this fallback is not real sentiment analysis and will
 * miss plenty; the honest expectation is "on" means "AI-checked" once a key
 * is configured.
 */
export async function classifyCommentAsNegative(comment: string): Promise<boolean> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackClassify(comment);

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 20,
      system:
        'Classify whether a customer feedback comment expresses genuine dissatisfaction (a real complaint, frustration, or negative experience) — not merely constructive or neutral phrasing. Respond with ONLY a JSON object {"negative": boolean} — no other text.',
      messages: [{ role: "user", content: comment }],
    });

    const text = message.content.find((block) => block.type === "text")?.text ?? "";
    const parsed = JSON.parse(text);
    return typeof parsed.negative === "boolean" ? parsed.negative : fallbackClassify(comment);
  } catch (err) {
    console.error("[ai-sentiment] Claude call failed, using fallback", err);
    return fallbackClassify(comment);
  }
}

const NEGATIVE_KEYWORDS = [
  "terrible",
  "awful",
  "horrible",
  "worst",
  "disgusting",
  "rude",
  "unacceptable",
  "disappointed",
  "disappointing",
  "never again",
  "waste of",
  "refund",
  "complain",
  "complaint",
  "poor service",
  "poor quality",
  "cold food",
  "dirty",
  "slow service",
  "ignored",
  "unhelpful",
  "broken",
  "overpriced",
  "won't be back",
  "wont be back",
  "not coming back",
];

function fallbackClassify(comment: string): boolean {
  const lower = comment.toLowerCase();
  return NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw));
}
