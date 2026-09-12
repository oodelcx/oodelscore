import Anthropic from "@anthropic-ai/sdk";
import type { ActionPriority } from "../models/ActionBoardItem";

export interface TriageSuggestion {
  title: string;
  priority: ActionPriority;
  categoryId: string | null; // one of the provided category ids, or null if none fit
}

interface TriageInput {
  comment: string | null;
  ruleDescription: string; // e.g. "fixed threshold: star average dropped below 3.0"
  categories: { id: string; name: string }[];
}

/**
 * Spec Section 16: AI-assisted Action Board triage. Uses Claude Haiku 4.5
 * (the cheapest model, appropriate since this is templated classification,
 * not open-ended reasoning) to turn a triggering response's comment into a
 * real title + severity + best-matching category.
 *
 * Gated behind ANTHROPIC_API_KEY being set — falls back to a deterministic,
 * non-AI default when it's not, so the feature degrades gracefully instead
 * of blocking alert firing on a missing/unfunded API key.
 */
export async function generateTriageSuggestion(input: TriageInput): Promise<TriageSuggestion> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackSuggestion(input);

  try {
    const client = new Anthropic({ apiKey });
    const categoryList = input.categories.map((c) => `${c.id}: ${c.name}`).join("\n") || "(no categories configured)";

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        "You triage customer feedback alerts into Action Board items. Respond with ONLY a JSON object " +
        '{"title": string, "priority": "low"|"medium"|"high"|"critical", "categoryId": string|null} — no other text. ' +
        "title must be a short, specific, descriptive summary of the actual issue (never a generic phrase like " +
        '"Low rating alert"). categoryId must be one of the given category ids, or null if none fit.',
      messages: [
        {
          role: "user",
          content: `Alert condition: ${input.ruleDescription}\nRespondent comment: ${input.comment ?? "(no comment left)"}\n\nAvailable categories:\n${categoryList}`,
        },
      ],
    });

    const text = message.content.find((block) => block.type === "text")?.text ?? "";
    const parsed = JSON.parse(text);
    const priority: ActionPriority = ["low", "medium", "high", "critical"].includes(parsed.priority) ? parsed.priority : "medium";
    const categoryId = input.categories.some((c) => c.id === parsed.categoryId) ? parsed.categoryId : null;

    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : fallbackSuggestion(input).title,
      priority,
      categoryId,
    };
  } catch (err) {
    console.error("[ai-triage] Claude call failed, using fallback", err);
    return fallbackSuggestion(input);
  }
}

function fallbackSuggestion(input: TriageInput): TriageSuggestion {
  const snippet = input.comment?.trim().slice(0, 80);
  return {
    title: snippet ? `Alert: "${snippet}${input.comment && input.comment.length > 80 ? "…" : ""}"` : `Alert: ${input.ruleDescription}`,
    priority: "medium",
    categoryId: null,
  };
}
