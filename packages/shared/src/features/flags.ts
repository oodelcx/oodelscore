/**
 * Per-account feature flags (task #121). Admin can turn individual advanced
 * features on/off for any Business or Parent Org — e.g. a lower-tier plan
 * without Reports, or a pilot account that shouldn't see Playbooks yet.
 * Core CRUD (Feedback Points, Raw Feedback, Case Management, Team Members,
 * Billing, Security, Messages, Support) is never gated here — only the
 * higher-tier analytical/AI features that map onto a nav section.
 *
 * Storage: `enabledFeatures: string[]` on Business/ParentOrganization.
 * `undefined`/`null` (a record saved before this shipped) means "all on" —
 * see hasFeature() below — so nothing changes for existing accounts until
 * Admin explicitly edits one.
 */
export const FEATURE_DEFINITIONS = [
  { key: "insights", label: "Insights", description: "AI-generated feedback insight reports." },
  { key: "analytics", label: "Analytics", description: "Trend, tag, and driver analytics dashboards." },
  { key: "alertRules", label: "Alert Rules", description: "Configurable score/volume alert thresholds and notifications." },
  { key: "reports", label: "Reports", description: "Downloadable period reports (PDF/export)." },
  { key: "improvementInitiatives", label: "Improvement Initiatives", description: "Structured improvement-initiative tracking." },
  { key: "decisionLog", label: "Decision Log", description: "Decision log with before/after outcome measurement." },
  { key: "cxPulse", label: "CX Pulse", description: "CX maturity scoring ladder." },
  { key: "playbooks", label: "Playbook Library", description: "Playbook library and automated trigger runs." },
] as const;

export type FeatureKey = (typeof FEATURE_DEFINITIONS)[number]["key"];

export const ALL_FEATURE_KEYS: FeatureKey[] = FEATURE_DEFINITIONS.map((f) => f.key);

const FEATURE_KEY_SET: ReadonlySet<string> = new Set(ALL_FEATURE_KEYS);

export function isValidFeatureKey(key: string): key is FeatureKey {
  return FEATURE_KEY_SET.has(key);
}

/**
 * undefined/null enabledFeatures (pre-migration record, or Admin never
 * touched it) defaults to "everything on" — this must never silently lock
 * an existing account out of a feature it already had.
 */
export function hasFeature(enabledFeatures: readonly string[] | undefined | null, key: FeatureKey): boolean {
  if (!enabledFeatures) return true;
  return enabledFeatures.includes(key);
}
