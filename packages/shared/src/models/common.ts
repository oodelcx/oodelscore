import { Schema } from "mongoose";

export interface IAddress {
  street: string;
  city: string;
  postcode: string;
}

export const AddressSchema = new Schema<IAddress>(
  {
    street: { type: String, default: "" },
    city: { type: String, default: "" },
    postcode: { type: String, default: "" },
  },
  { _id: false }
);

/**
 * Red/amber/green banding for the two headline metrics (star average, NPS)
 * used by the Group Command Center and anywhere else a business/branch
 * needs a traffic-light read. A value >= the green minimum is green,
 * >= the amber minimum (but below green) is amber, otherwise red.
 * Admin sets this once per Parent Org — every branch under it inherits the
 * same bands — and independently per standalone business (spec: "standalone
 * businesses will be set" with their own ranges).
 */
export interface IRagThresholds {
  starGreenMin: number; // e.g. 3.7
  starAmberMin: number; // e.g. 3.0
  npsGreenMin: number; // e.g. 30
  npsAmberMin: number; // e.g. 0
}

export const DEFAULT_RAG_THRESHOLDS: IRagThresholds = {
  starGreenMin: 3.7,
  starAmberMin: 3.0,
  npsGreenMin: 30,
  npsAmberMin: 0,
};

export const RagThresholdsSchema = new Schema<IRagThresholds>(
  {
    starGreenMin: { type: Number, default: DEFAULT_RAG_THRESHOLDS.starGreenMin },
    starAmberMin: { type: Number, default: DEFAULT_RAG_THRESHOLDS.starAmberMin },
    npsGreenMin: { type: Number, default: DEFAULT_RAG_THRESHOLDS.npsGreenMin },
    npsAmberMin: { type: Number, default: DEFAULT_RAG_THRESHOLDS.npsAmberMin },
  },
  { _id: false }
);

export function ragBandForStar(value: number | null, thresholds: IRagThresholds): "green" | "amber" | "red" | null {
  if (value === null) return null;
  if (value >= thresholds.starGreenMin) return "green";
  if (value >= thresholds.starAmberMin) return "amber";
  return "red";
}

export function ragBandForNps(value: number | null, thresholds: IRagThresholds): "green" | "amber" | "red" | null {
  if (value === null) return null;
  if (value >= thresholds.npsGreenMin) return "green";
  if (value >= thresholds.npsAmberMin) return "amber";
  return "red";
}

/**
 * How Admin's own price for a business/parent org actually gets charged —
 * set once here, read at Checkout time to build Stripe pricing inline, so
 * Admin never has to create a Price in the Stripe Dashboard themselves:
 * - "monthly": a real recurring Stripe subscription, billed every month.
 * - "annual_monthly_rate": still a real recurring Stripe subscription,
 *   billed monthly — just at whatever (usually lower) rate Admin sets for
 *   an annual commitment, as opposed to the plain monthly rate.
 * - "annual_lump_sum": one real one-time charge covering a year, not a
 *   Stripe subscription at all — BillingSubscription.paidThroughDate is
 *   what tracks when it needs renewing, since Stripe won't auto-bill it
 *   again the way a subscription would.
 */
export const PRICING_INTERVALS = ["monthly", "annual_monthly_rate", "annual_lump_sum"] as const;
export type PricingInterval = (typeof PRICING_INTERVALS)[number];

/** Admin-set, never touches Stripe until a Checkout Session actually needs it. */
export interface IPricingTerms {
  amount: number | null; // major currency units (e.g. 49.00), null = not set yet
  currency: string; // lowercase ISO 4217, e.g. "usd"
  interval: PricingInterval | null; // null = not set yet
}

export const DEFAULT_PRICING_TERMS: IPricingTerms = { amount: null, currency: "usd", interval: null };

export const PricingTermsSchema = new Schema<IPricingTerms>(
  {
    amount: { type: Number, default: null },
    currency: { type: String, default: "usd" },
    interval: { type: String, enum: PRICING_INTERVALS, default: null },
  },
  { _id: false }
);

/**
 * One rung of an org's own escalation chain, configured once per Business or
 * ParentOrganization (branches inherit the org's the same way ragThresholds
 * does). Editable both by Admin (Accounts -> Escalation Workflow) and
 * self-service by the org's own owner (the Group head for a ParentOrg, or a
 * standalone Business's own owner) via /group/escalation or
 * /business/escalation. `level` is an ordinal (1 = the branch's own owner,
 * always), `label` is whatever the organisation calls that rung ("Cluster
 * Manager", "Area Manager", "President") — never a hardcoded job title, so
 * the same mechanism fits any customer's real hierarchy.
 */
export interface IEscalationLevel {
  level: number;
  label: string;
}

export const EscalationLevelSchema = new Schema<IEscalationLevel>(
  {
    level: { type: Number, required: true },
    label: { type: String, required: true, trim: true },
  },
  { _id: false }
);

/**
 * A single append-only note on a record (Improvement Initiative, Decision
 * Log entry, etc.) — a running commentary thread, not a field anyone
 * edits in place. `authorLabel` is captured at write time (not a live
 * ref lookup) so a note still reads sensibly after its author leaves the
 * team or is deleted.
 */
export interface INoteEntry {
  text: string;
  authorLabel: string;
  createdAt: Date;
}

export const NoteEntrySchema = new Schema<INoteEntry>(
  {
    text: { type: String, required: true, trim: true },
    authorLabel: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// A brand-new account starts with just the one rung every business already
// has for free — its own owner. Admin adds more during implementation.
export const DEFAULT_ESCALATION_LEVELS: IEscalationLevel[] = [{ level: 1, label: "Owner" }];


/**
 * A group's (or standalone business's) escalation structure.
 *  - enabled: false = still on the older numbered-levels setup (engine falls back to it).
 *  - tiers: the optional layers between the group and its branches, top to bottom
 *    (Region, Area, Cluster...). Names are the group's own words.
 *  - groupSteps: who handles escalations at group level, in order from the lowest
 *    group-level step up to the top (Operations Lead, then Group Head).
 *  - branchTitle: what the person who runs a branch is called.
 *  - slaByTier: optional hours per step; keys are "branch", a tier key, or "group".
 *    The single escalationSlaHours applies wherever a key is missing.
 */
export interface IStructureTier {
  key: string;
  name: string;
}
export interface IStructureStep {
  title: string;
  userId: import("mongoose").Types.ObjectId | null;
}
export interface IStructure {
  enabled: boolean;
  /** "pointers" = the "escalates to" model. Missing on an older tier-and-box setup, which is converted on first use. */
  model?: "pointers" | null;
  tiers: IStructureTier[];
  groupSteps: IStructureStep[];
  branchTitle: string;
  slaByTier: Record<string, number>;
}

export const StructureSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    model: { type: String, enum: ["pointers"], default: null },
    tiers: { type: [new Schema({ key: { type: String, required: true }, name: { type: String, required: true } }, { _id: false })], default: [] },
    groupSteps: {
      type: [new Schema({ title: { type: String, required: true }, userId: { type: Schema.Types.ObjectId, ref: "User", default: null } }, { _id: false })],
      default: [],
    },
    branchTitle: { type: String, default: "Branch manager" },
    slaByTier: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false }
);
