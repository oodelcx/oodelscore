import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { PRODUCTS, type Product } from "./products";

export const PLAYBOOK_TRIGGER_METRICS = ["categoryAverage", "negativeMentionCount"] as const;
export type PlaybookTriggerMetric = (typeof PLAYBOOK_TRIGGER_METRICS)[number];

export const PLAYBOOK_TRIGGER_COMPARATORS = ["below", "above"] as const;
export type PlaybookTriggerComparator = (typeof PLAYBOOK_TRIGGER_COMPARATORS)[number];

export interface IPlaybook {
  // Exactly one of these is set, enforced at the API layer (not here) — see
  // the identical DecisionLogEntry fix: a standalone business (no parent
  // org) needs its own Playbooks scope.
  parentOrgId: Types.ObjectId | null;
  businessId: Types.ObjectId | null;
  // Which product this playbook belongs to — defaults to customer_experience
  // so every playbook that predates Colleague Experience is unaffected.
  product: Product;
  title: string;
  categoryId: Types.ObjectId | null;
  triggerCondition: string; // human-readable label, e.g. "3+ mentions in 2 weeks" — shown even when no structured trigger is set below
  // Structured trigger (CX intelligence roadmap Phase 4 — "operational
  // guidance, not just documents"): when set, evaluatePlaybookTrigger can
  // actually check this against real data instead of the condition living
  // only as descriptive text. All optional — a playbook with no structured
  // trigger still works purely as a checklist template.
  triggerMetric: PlaybookTriggerMetric | null;
  triggerComparator: PlaybookTriggerComparator | null;
  triggerThreshold: number | null;
  triggerWindowDays: number | null; // only meaningful for negativeMentionCount
  steps: string[];
  escalationContactId: Types.ObjectId | null;
  usageCount: number; // incremented when a PlaybookRun against this playbook completes
  createdAt: Date;
  updatedAt: Date;
}

const PlaybookSchema = new Schema<IPlaybook>(
  {
    parentOrgId: { type: Schema.Types.ObjectId, ref: "ParentOrganization", default: null },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", default: null },
    product: { type: String, enum: PRODUCTS, default: "customer_experience" },
    title: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    triggerCondition: { type: String, default: "" },
    triggerMetric: { type: String, enum: PLAYBOOK_TRIGGER_METRICS, default: null },
    triggerComparator: { type: String, enum: PLAYBOOK_TRIGGER_COMPARATORS, default: null },
    triggerThreshold: { type: Number, default: null },
    triggerWindowDays: { type: Number, default: null },
    steps: { type: [String], default: [] },
    escalationContactId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PlaybookSchema.index({ businessId: 1, categoryId: 1 });
PlaybookSchema.index({ parentOrgId: 1, categoryId: 1 });

export const Playbook: Model<IPlaybook> = mongoose.models.Playbook ?? model<IPlaybook>("Playbook", PlaybookSchema);
