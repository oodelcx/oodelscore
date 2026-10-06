import Anthropic from "@anthropic-ai/sdk";
import type { ProgramEvaluationEvidence } from "../scoring/programEvaluationEvidence";
import type { IProgramEvaluationObjectiveMatch } from "../models/ProgramEvaluationReport";

export interface ProgramEvaluationNarrative {
  summary: string;
  objectiveMatches: IProgramEvaluationObjectiveMatch[];
  suggestions: string[];
  newAreasToExplore: string[];
  generatedByAi: boolean;
  fallbackReason: "no_api_key" | "api_error" | "parse_error" | null;
}

const VERDICTS = ["met", "partially_met", "not_supported"] as const;

/**
 * Evidence-gated, same discipline as ../ai/rootCause.ts: the model is
 * never shown raw free-form prompts about "how did this training go" —
 * only the pre-computed evidence bundle (real scores, real demographic
 * cuts, real themes, real comments) and asked to match it against the
 * business's own stated objectives. Every objective's verdict must cite a
 * specific fact from the evidence; "not_supported" is a legitimate,
 * expected verdict when the evidence genuinely doesn't speak to an
 * objective, not something to be talked around.
 */
export async function analyzeProgramEvaluation(evidence: ProgramEvaluationEvidence): Promise<ProgramEvaluationNarrative> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackNarrative(evidence, "no_api_key");

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system:
        "You evaluate a training/program's feedback against the objectives its own organizers stated — using ONLY the evidence given to you, never inventing a fact, number, or quote not present in it. " +
        "Respond with ONLY a JSON object: " +
        '{"summary": string, "objectiveMatches": [{"objective": string, "verdict": "met"|"partially_met"|"not_supported", "evidence": string}], "suggestions": string[], "newAreasToExplore": string[]} — no other text. ' +
        "objectiveMatches must have exactly one entry per objective given, in the same order. " +
        "questionStats lists each survey question with its average (1-5 ratings, 0-10 recommend score) or its answer counts: match each objective to the question(s) that actually asked about it and cite that figure (e.g. \"4.3/5 agreed they can prepare a budget\"). A rating of 4 or more on the matching question usually supports \"met\", about 3 to 4 \"partially_met\", and lower \"not_supported\", unless comments clearly say otherwise. " +
        '"evidence" must cite a specific number, demographic cut, or direct comment from the evidence bundle — never a vague restatement. ' +
        'Use "not_supported" honestly whenever the evidence doesn\'t actually speak to that objective (e.g. no relevant comments or scores) — do not stretch weak evidence into "met" to sound more conclusive than the data supports. ' +
        "suggestions are concrete program changes grounded in what the evidence actually shows (a specific theme, a specific demographic gap) — never generic training advice. " +
        "Keep it tight: summary at most 4 sentences, each evidence at most 2 sentences, at most 4 suggestions and 3 newAreasToExplore. "
        + "newAreasToExplore are specific follow-up questions or angles the current feedback doesn't cover but the evidence suggests would be worth asking next time.",
      messages: [{ role: "user", content: `Evidence:\n${JSON.stringify(evidence, null, 2)}` }],
    });

    const text = message.content.find((block) => block.type === "text")?.text ?? "";
    const stripped = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(stripped);
    } catch (parseErr) {
      console.error("[ai-program-evaluation] Claude response was not parseable JSON, using fallback", parseErr, text);
      return fallbackNarrative(evidence, "parse_error");
    }

    const objectiveMatches: IProgramEvaluationObjectiveMatch[] = evidence.objectives.map((objective, i) => {
      const match = Array.isArray(parsed.objectiveMatches) ? parsed.objectiveMatches[i] : null;
      const verdict = (VERDICTS as readonly string[]).includes(match?.verdict) ? match.verdict : "not_supported";
      return {
        objective,
        verdict,
        evidence: typeof match?.evidence === "string" ? match.evidence : "No AI-generated evidence available for this objective.",
      };
    });

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : fallbackNarrative(evidence).summary,
      objectiveMatches,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s: unknown) => typeof s === "string") : [],
      newAreasToExplore: Array.isArray(parsed.newAreasToExplore) ? parsed.newAreasToExplore.filter((s: unknown) => typeof s === "string") : [],
      generatedByAi: true,
      fallbackReason: null,
    };
  } catch (err) {
    console.error("[ai-program-evaluation] Claude call failed, using fallback", err);
    return fallbackNarrative(evidence, "api_error");
  }
}

/** No AI available — states the real numbers plainly, no reasoned narrative. */
function fallbackNarrative(
  evidence: ProgramEvaluationEvidence,
  reason: "no_api_key" | "api_error" | "parse_error" = "api_error"
): ProgramEvaluationNarrative {
  return {
    summary: `${evidence.responseCount} responses for "${evidence.eventName}"${
      evidence.starAverage !== null ? `, averaging ${evidence.starAverage}/5` : ""
    }. AI analysis unavailable — review the scores, themes, and comments directly.`,
    objectiveMatches: evidence.objectives.map((objective) => ({
      objective,
      verdict: "not_supported",
      evidence: "AI analysis unavailable — no automated match against this objective.",
    })),
    suggestions: [],
    newAreasToExplore: [],
    generatedByAi: false,
    fallbackReason: reason,
  };
}
