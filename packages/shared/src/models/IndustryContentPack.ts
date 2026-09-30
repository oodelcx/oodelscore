import mongoose, { Schema, model, type Model } from "mongoose";

/**
 * The industry-specific wording overlay for OodelCX Compass — see
 * PRODUCT-ROADMAP.md Phase 7 "Industry-specific wording." Every account
 * answers the identical ANCHOR question set on the identical scoring
 * engine; this only supplies the concrete examples interpolated into a
 * few of those questions (via the {{token}} placeholders in
 * ../compass/questionBank.ts), keyed to the same industry name already
 * stored on Business/ParentOrganization — nothing new to collect from the
 * account itself. Admin-editable (same ownership model as Industry
 * itself); an industry with no pack here falls back to
 * DEFAULT_INDUSTRY_CONTENT in ../compass/industryContent.ts, never blocks
 * the assessment.
 */
export interface IIndustryContentPack {
  industry: string;
  numbersOutcomeExamples: string;
  hearingChannelExamples: string;
  ownershipRoleExamples: string;
  rhythmTriggerExample: string;
  createdAt: Date;
  updatedAt: Date;
}

const IndustryContentPackSchema = new Schema<IIndustryContentPack>(
  {
    industry: { type: String, required: true, unique: true, trim: true },
    numbersOutcomeExamples: { type: String, default: "" },
    hearingChannelExamples: { type: String, default: "" },
    ownershipRoleExamples: { type: String, default: "" },
    rhythmTriggerExample: { type: String, default: "" },
  },
  { timestamps: true }
);

export const IndustryContentPack: Model<IIndustryContentPack> =
  mongoose.models.IndustryContentPack ?? model<IIndustryContentPack>("IndustryContentPack", IndustryContentPackSchema);
