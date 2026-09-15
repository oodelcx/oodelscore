import { Types } from "mongoose";
import Anthropic from "@anthropic-ai/sdk";
import { Response } from "../models/Response";
import type { Sentiment } from "../models/Response";

export interface ThemeSentimentResult {
  sentiment: Sentiment;
  themes: string[]; // 0-3 short lowercase tags, e.g. "wait time", "staff friendliness"
}

const FALLBACK_NEGATIVE_WORDS = /\b(bad|slow|wait|long|cold|rude|dirty|poor|late|never|worst|disappoint)\w*\b/i;
const FALLBACK_POSITIVE_WORDS = /\b(great|love|excellent|friendly|clean|fast|amazing|best|helpful|wonderful)\w*\b/i;

/**
 * CX intelligence roadmap Phase 2 (text analytics — the one item called out
 * as a must-have): turns one open-ended comment into a sentiment label and
 * a handful of theme tags. Uses Claude Haiku 4.5, same model and same
 * gated/graceful-fallback pattern as the existing AI-assisted triage
 * (spec Section 16) — degrades to a keyword heuristic instead of blocking
 * feedback submission when ANTHROPIC_API_KEY isn't set.
 */
export async function analyzeThemeSentiment(comment: string): Promise<ThemeSentimentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback(comment);

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system:
        'You extract structured signal from one piece of customer feedback. Respond with ONLY a JSON object {"sentiment": "positive"|"neutral"|"negative", "themes": string[]} — no other text. ' +
        'themes is 0-3 short lowercase tags (2-3 words each, e.g. "wait time", "staff friendliness", "value for money") naming what the comment is actually about. ' +
        "Return themes: [] if the comment is too short or vague to categorize. Never invent a theme the comment doesn't support.",
      messages: [{ role: "user", content: comment }],
    });

    const text = message.content.find((block) => block.type === "text")?.text ?? "";
    const parsed = JSON.parse(text);
    const sentiment: Sentiment = (["positive", "neutral", "negative"] as const).includes(parsed.sentiment)
      ? parsed.sentiment
      : fallback(comment).sentiment;
    const themes = Array.isArray(parsed.themes)
      ? parsed.themes.filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0).slice(0, 3)
      : [];

    return { sentiment, themes };
  } catch (err) {
    console.error("[ai-theme-sentiment] Claude call failed, using fallback", err);
    return fallback(comment);
  }
}

function fallback(comment: string): ThemeSentimentResult {
  const negative = FALLBACK_NEGATIVE_WORDS.test(comment);
  const positive = FALLBACK_POSITIVE_WORDS.test(comment);
  const sentiment: Sentiment = negative && !positive ? "negative" : positive && !negative ? "positive" : "neutral";
  return { sentiment, themes: [] };
}

const BACKFILL_BATCH_SIZE = 50;

/**
 * Analyzes existing responses that predate this feature (or that failed
 * analysis at submit time), capped per call so an admin/owner-triggered
 * "Analyze feedback" click can't run unbounded. Only touches responses with
 * an open_text answer that haven't been analyzed yet.
 */
export async function backfillThemeSentiment(businessIds: (Types.ObjectId | string)[]): Promise<{ analyzed: number; remaining: number }> {
  const filter = {
    businessId: { $in: businessIds },
    sentimentAnalyzedAt: null,
    "answers.type": "open_text",
  };

  const [candidates, remaining] = await Promise.all([
    Response.find(filter).select("answers").limit(BACKFILL_BATCH_SIZE),
    Response.countDocuments(filter),
  ]);

  let analyzed = 0;
  for (const response of candidates) {
    const openText = response.answers.find((a) => a.type === "open_text" && typeof a.value === "string" && a.value.trim());
    const comment = typeof openText?.value === "string" ? openText.value : null;
    if (!comment) {
      // Shouldn't happen given the filter, but never leave a response stuck
      // reprocessing forever if its open_text answer turns out to be blank.
      await Response.findByIdAndUpdate(response._id, { sentimentAnalyzedAt: new Date() });
      continue;
    }
    const result = await analyzeThemeSentiment(comment);
    await Response.findByIdAndUpdate(response._id, {
      sentiment: result.sentiment,
      themes: result.themes,
      sentimentAnalyzedAt: new Date(),
    });
    analyzed++;
  }

  return { analyzed, remaining: Math.max(remaining - analyzed, 0) };
}
