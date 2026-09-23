import Anthropic from "@anthropic-ai/sdk";
import type { ActionPriority } from "../models/ActionBoardItem";
import type { RootCauseEvidence } from "../scoring/rootCauseEvidence";

export interface RootCauseRecommendation {
  description: string;
  suggestedOwnerRole: string; // free text, e.g. "Operations Manager" — no real owner list is given to the model
  priority: ActionPriority;
}

export interface RootCauseAnalysis {
  observedIssue: string;
  contributingFactors: string[];
  likelyRootCause: string;
  confidenceLabel: "likely" | "inferred" | "uncertain";
  recommendation: RootCauseRecommendation;
  generatedByAi: boolean; // false when this came from the non-AI fallback
  // Only set when generatedByAi is false — lets a caller (or QA, without
  // server-log access) tell "no key configured" apart from "the API call
  // itself failed" apart from "the call succeeded but the response wasn't
  // parseable JSON" instead of all three looking identical from the outside.
  fallbackReason: "no_api_key" | "api_error" | "parse_error" | null;
}

/**
 * CX intelligence roadmap Phase 3. The hard architectural rule from the
 * whole roadmap discussion applies here more than anywhere else: the model
 * is never shown raw response text and asked to guess a cause. It is only
 * ever shown the pre-computed `RootCauseEvidence` bundle (real deltas,
 * real counts, real prior-decision outcomes) and asked to explain *that* —
 * every contributing factor and the root cause itself must trace back to a
 * field in the evidence, and the result is explicitly labeled likely/
 * inferred/uncertain, never stated as settled fact.
 *
 * Uses Haiku, same as every other AI call site in this codebase — kept
 * consistent for cost predictability. The evidence-gated prompt does the
 * real work here (every claim must trace back to a field in the evidence
 * bundle), so the smaller model still produces a well-grounded explanation.
 */
export async function analyzeRootCause(evidence: RootCauseEvidence): Promise<RootCauseAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackAnalysis(evidence, "no_api_key");

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system:
        "You explain a customer-experience problem using ONLY the evidence given to you — never invent a fact, number, or cause not present in the evidence. " +
        "Respond with ONLY a JSON object: " +
        '{"observedIssue": string, "contributingFactors": string[], "likelyRootCause": string, "confidenceLabel": "likely"|"inferred"|"uncertain", ' +
        '"recommendation": {"description": string, "suggestedOwnerRole": string, "priority": "low"|"medium"|"high"|"critical"}} — no other text. ' +
        'contributingFactors must each cite a specific number or fact from the evidence (e.g. "63% of negative comments fell between 12:00-14:00"), not vague statements. ' +
        'confidenceLabel: use "likely" only when multiple independent pieces of evidence point the same way, "inferred" when there\'s a plausible story but thinner support, ' +
        '"uncertain" when the evidence is genuinely ambiguous or too sparse — in that case say so plainly in likelyRootCause rather than forcing a confident-sounding answer. ' +
        'This is survey evidence, not a controlled experiment — phrase likelyRootCause as the explanation the evidence best supports ("the evidence points to...", "most consistent with...") rather than a proven cause, and never claim certainty the evidence doesn\'t have.',
      messages: [{ role: "user", content: `Evidence:\n${JSON.stringify(evidence, null, 2)}` }],
    });

    const text = message.content.find((block) => block.type === "text")?.text ?? "";

    // Claude sometimes wraps JSON output in a markdown code fence even when
    // told not to — strip it before parsing rather than letting a
    // successful, billed API call get mislabeled as an "api_error".
    const stripped = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(stripped);
    } catch (parseErr) {
      console.error("[ai-root-cause] Claude response was not parseable JSON, using fallback", parseErr, text);
      return fallbackAnalysis(evidence, "parse_error");
    }

    const confidenceLabel: RootCauseAnalysis["confidenceLabel"] = (["likely", "inferred", "uncertain"] as const).includes(
      parsed.confidenceLabel
    )
      ? parsed.confidenceLabel
      : "uncertain";
    const priority: ActionPriority = (["low", "medium", "high", "critical"] as const).includes(parsed.recommendation?.priority)
      ? parsed.recommendation.priority
      : "medium";

    return {
      observedIssue: typeof parsed.observedIssue === "string" ? parsed.observedIssue : fallbackAnalysis(evidence).observedIssue,
      contributingFactors: Array.isArray(parsed.contributingFactors) ? parsed.contributingFactors.filter((f: unknown) => typeof f === "string") : [],
      likelyRootCause: typeof parsed.likelyRootCause === "string" ? parsed.likelyRootCause : fallbackAnalysis(evidence).likelyRootCause,
      confidenceLabel,
      recommendation: {
        description:
          typeof parsed.recommendation?.description === "string"
            ? parsed.recommendation.description
            : fallbackAnalysis(evidence).recommendation.description,
        suggestedOwnerRole: typeof parsed.recommendation?.suggestedOwnerRole === "string" ? parsed.recommendation.suggestedOwnerRole : "Operations Manager",
        priority,
      },
      generatedByAi: true,
      fallbackReason: null,
    };
  } catch (err) {
    console.error("[ai-root-cause] Claude call failed, using fallback", err);
    return fallbackAnalysis(evidence, "api_error");
  }
}

/**
 * No AI available — still genuinely useful, since the evidence bundle
 * itself already contains the real numbers. Just states them plainly
 * instead of narrating, and is honest that it's an unweighted list, not a
 * reasoned explanation.
 */
function fallbackAnalysis(
  evidence: RootCauseEvidence,
  reason: "no_api_key" | "api_error" | "parse_error" = "api_error"
): RootCauseAnalysis {
  const factors: string[] = [];
  if (evidence.previousPeriodAverage !== null && evidence.currentPeriodAverage !== null) {
    const delta = Math.round((evidence.currentPeriodAverage - evidence.previousPeriodAverage) * 100) / 100;
    factors.push(`${evidence.categoryName} average moved from ${evidence.previousPeriodAverage} to ${evidence.currentPeriodAverage} (${delta >= 0 ? "+" : ""}${delta})`);
  }
  if (evidence.currentPeriodNegativeCount > evidence.previousPeriodNegativeCount) {
    factors.push(`Negative-sentiment responses touching this category rose from ${evidence.previousPeriodNegativeCount} to ${evidence.currentPeriodNegativeCount}`);
  }
  if (evidence.topHourConcentration.length > 0) {
    factors.push(`Most negative mentions cluster around ${evidence.topHourConcentration[0].hourRange} (${evidence.topHourConcentration[0].count} mentions)`);
  }
  if (evidence.branchBreakdown.length > 0) {
    factors.push(`Lowest-scoring branch: ${evidence.branchBreakdown[0].name} (${evidence.branchBreakdown[0].currentAverage})`);
  }
  if (evidence.priorDecision) {
    factors.push(
      `A previous decision ("${evidence.priorDecision.title}") targeting this category was measured as ${evidence.priorDecision.verdict ?? "not conclusive"}`
    );
  }

  return {
    observedIssue: `${evidence.categoryName} shows ${evidence.currentPeriodAverage ?? "no"} average over the last period, based on ${evidence.currentPeriodResponseCount} responses.`,
    contributingFactors: factors,
    likelyRootCause: "AI analysis unavailable — review the contributing factors above directly.",
    confidenceLabel: "uncertain",
    recommendation: {
      description: `Review ${evidence.categoryName.toLowerCase()} feedback from the period above and assign an owner to investigate.`,
      suggestedOwnerRole: "Operations Manager",
      priority: "medium",
    },
    generatedByAi: false,
    fallbackReason: reason,
  };
}
