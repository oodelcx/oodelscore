import { IndustryContentPack } from "../models/IndustryContentPack";

export interface IndustryContentFields {
  numbersOutcomeExamples: string;
  hearingChannelExamples: string;
  ownershipRoleExamples: string;
  rhythmTriggerExample: string;
}

// Neutral wording for any industry without an authored pack yet (Admin can
// add new industry names at any time) — never blocks the assessment, never
// shows an unfilled {{token}}.
export const DEFAULT_INDUSTRY_CONTENT: IndustryContentFields = {
  numbersOutcomeExamples: " (e.g. reduced churn, fewer complaints, higher repeat engagement)",
  hearingChannelExamples: " (e.g. in-person surveys, an app, email, a QR code)",
  ownershipRoleExamples: " (e.g. a named manager or team)",
  rhythmTriggerExample: "",
};

/**
 * Real content packs for the 7 industries confirmed for launch — see
 * PRODUCT-ROADMAP.md Phase 7. Seeded by seedIndustryContentPacks() below;
 * exported separately so the seed function and any future Admin UI can
 * both read from one source of truth.
 */
export const SEED_INDUSTRY_CONTENT_PACKS: Record<string, IndustryContentFields> = {
  Banking: {
    numbersOutcomeExamples: " — e.g. reduced account churn, fewer complaints escalated to the ombudsman, higher cross-sell after branch visits",
    hearingChannelExamples: " — e.g. branch exit surveys, app/online banking NPS, call-centre post-interaction surveys",
    ownershipRoleExamples: " — routed to a named complaints handler, or does it sit in a shared inbox",
    rhythmTriggerExample: " — e.g. the same complaint type appearing across several branches",
  },
  Education: {
    numbersOutcomeExamples: " — e.g. improved attendance, fewer formal parent complaints, better satisfaction at re-enrolment",
    hearingChannelExamples: " — e.g. parent surveys, student pulse checks, staff feedback sessions",
    ownershipRoleExamples: " — routed to a Head of Year / Pastoral Lead, or handled informally by whichever staff member hears it",
    rhythmTriggerExample: " — e.g. the same concern raised by several parents or students in a term",
  },
  Restaurant: {
    numbersOutcomeExamples: " — e.g. higher repeat-visit rate, better average review score, fewer walkouts after a service issue",
    hearingChannelExamples: " — e.g. a table QR code, a receipt survey, monitoring third-party review sites",
    ownershipRoleExamples: " — routed to the shift manager, or handled by whichever server is nearest",
    rhythmTriggerExample: " — e.g. the same dish or service complaint recurring across shifts",
  },
  Healthcare: {
    numbersOutcomeExamples: " — e.g. fewer formal complaints, improved patient satisfaction scores, better outcomes on re-admission",
    hearingChannelExamples: " — e.g. post-visit surveys, ward feedback cards, a patient portal",
    ownershipRoleExamples: " — routed to a Ward Sister / Patient Experience Lead, or handled informally by frontline staff",
    rhythmTriggerExample: " — e.g. the same concern raised across multiple wards or shifts",
  },
  Aviation: {
    numbersOutcomeExamples: " — e.g. improved lounge/gate satisfaction scores, fewer missed-connection complaints, better perceived on-time performance",
    hearingChannelExamples: " — e.g. gate/lounge tablets, a post-flight email survey, an app",
    ownershipRoleExamples: " — routed to the Duty Manager / Station Ops, or handled ad hoc by whoever's nearest",
    rhythmTriggerExample: " — e.g. the same complaint recurring across flights or routes",
  },
  Telecommunications: {
    numbersOutcomeExamples: " — e.g. reduced churn, fewer repeat calls for the same issue, higher NPS after a support interaction",
    hearingChannelExamples: " — e.g. post-call surveys, app feedback, a support-ticket satisfaction rating",
    ownershipRoleExamples: " — routed to a named account/support owner, or does it sit in a general queue",
    rhythmTriggerExample: " — e.g. the same fault type generating repeat contacts",
  },
  "Community Development & Training": {
    numbersOutcomeExamples: " — e.g. improved participant completion rates, fewer formal grievances, better outcomes reported at follow-up",
    hearingChannelExamples: " — e.g. end-of-session surveys, participant interviews, community forums",
    ownershipRoleExamples: " — routed to a named programme coordinator, or handled informally by facilitators",
    rhythmTriggerExample: " — e.g. the same barrier raised across multiple cohorts or sessions",
  },
};

function fillTemplate(text: string, content: IndustryContentFields): string {
  return text
    .replaceAll("{{numbersOutcomeExamples}}", content.numbersOutcomeExamples)
    .replaceAll("{{hearingChannelExamples}}", content.hearingChannelExamples)
    .replaceAll("{{ownershipRoleExamples}}", content.ownershipRoleExamples)
    .replaceAll("{{rhythmTriggerExample}}", content.rhythmTriggerExample);
}

/** Renders one question's text against a resolved content pack. */
export function renderQuestionText(template: string, content: IndustryContentFields): string {
  return fillTemplate(template, content);
}

/**
 * Looks up the account's industry in the DB; falls back to
 * DEFAULT_INDUSTRY_CONTENT for any industry with no authored pack yet
 * (including an empty/unset industry string) — never throws, never blocks
 * taking the assessment.
 */
export async function resolveIndustryContent(industry: string | null | undefined): Promise<IndustryContentFields> {
  if (!industry) return DEFAULT_INDUSTRY_CONTENT;
  const pack = await IndustryContentPack.findOne({ industry }).lean();
  if (!pack) return DEFAULT_INDUSTRY_CONTENT;
  return {
    numbersOutcomeExamples: pack.numbersOutcomeExamples,
    hearingChannelExamples: pack.hearingChannelExamples,
    ownershipRoleExamples: pack.ownershipRoleExamples,
    rhythmTriggerExample: pack.rhythmTriggerExample,
  };
}

/** Upserts the 7 launch-industry packs — called from seedShowcaseData(). */
export async function seedIndustryContentPacks(): Promise<void> {
  for (const [industry, content] of Object.entries(SEED_INDUSTRY_CONTENT_PACKS)) {
    await IndustryContentPack.findOneAndUpdate({ industry }, { $set: { industry, ...content } }, { upsert: true });
  }
}
