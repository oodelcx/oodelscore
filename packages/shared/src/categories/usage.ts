import { Types } from "mongoose";
import { Business } from "../models/Business";
import { FeedbackPoint } from "../models/FeedbackPoint";
import { QuestionTemplate } from "../models/QuestionTemplate";
import { ParentOrganization } from "../models/ParentOrganization";

/**
 * A category only becomes real for a business through its actual survey —
 * a question, tagged with that category, on whichever Question Template the
 * business is currently using (its own default, or a per-feedback-point
 * override). Rather than maintaining a separate, manually-kept "category is
 * assigned to this business" list (which could drift from what the survey
 * actually asks), usage is always derived live from that real data — one
 * source of truth, always accurate.
 */

async function categoryIdsByTemplateId(templateIds: string[]): Promise<Map<string, Set<string>>> {
  const templates = templateIds.length ? await QuestionTemplate.find({ _id: { $in: templateIds } }).select("questions") : [];
  const map = new Map<string, Set<string>>();
  for (const t of templates) {
    const cats = new Set<string>();
    for (const q of t.questions) if (q.categoryId) cats.add(q.categoryId.toString());
    map.set(t._id.toString(), cats);
  }
  return map;
}

function effectiveTemplateIdsForBusiness(
  business: { questionTemplateId?: Types.ObjectId | null },
  feedbackPointOverrides: (Types.ObjectId | null | undefined)[]
): Set<string> {
  const ids = new Set<string>();
  if (business.questionTemplateId) ids.add(business.questionTemplateId.toString());
  for (const override of feedbackPointOverrides) if (override) ids.add(override.toString());
  return ids;
}

/** Every category currently in use by one business's actual survey. */
export async function getCategoriesInUseForBusiness(businessId: Types.ObjectId | string): Promise<Set<string>> {
  const business = await Business.findById(businessId).select("questionTemplateId");
  if (!business) return new Set();

  const feedbackPoints = await FeedbackPoint.find({ businessId }).select("questionTemplateOverride");
  const templateIds = effectiveTemplateIdsForBusiness(
    business,
    feedbackPoints.map((fp) => fp.questionTemplateOverride)
  );
  if (templateIds.size === 0) return new Set();

  const catsByTemplate = await categoryIdsByTemplateId([...templateIds]);
  const result = new Set<string>();
  for (const cats of catsByTemplate.values()) for (const c of cats) result.add(c);
  return result;
}

/** Every category currently in use across any of a Parent Org's branches. */
export async function getCategoriesInUseForParentOrg(parentOrgId: Types.ObjectId | string): Promise<Set<string>> {
  const businesses = await Business.find({ parentOrgId }).select("questionTemplateId");
  if (businesses.length === 0) return new Set();

  const businessIds = businesses.map((b) => b._id);
  const feedbackPoints = await FeedbackPoint.find({ businessId: { $in: businessIds } }).select(
    "businessId questionTemplateOverride"
  );
  const overridesByBusiness = new Map<string, Types.ObjectId[]>();
  for (const fp of feedbackPoints) {
    if (!fp.questionTemplateOverride) continue;
    const key = fp.businessId.toString();
    const list = overridesByBusiness.get(key) ?? [];
    list.push(fp.questionTemplateOverride);
    overridesByBusiness.set(key, list);
  }

  const allTemplateIds = new Set<string>();
  for (const b of businesses) {
    const ids = effectiveTemplateIdsForBusiness(b, overridesByBusiness.get(b._id.toString()) ?? []);
    for (const id of ids) allTemplateIds.add(id);
  }
  if (allTemplateIds.size === 0) return new Set();

  const catsByTemplate = await categoryIdsByTemplateId([...allTemplateIds]);
  const result = new Set<string>();
  for (const cats of catsByTemplate.values()) for (const c of cats) result.add(c);
  return result;
}

export interface CategoryUsageEntry {
  businessId: string;
  businessName: string;
  parentOrgId: string | null;
  parentOrgName: string | null;
}

/**
 * Platform-wide: for every category, every business currently using it —
 * the read-only report Admin needs ("which categories have been assigned to
 * which banks, schools") without a separate assignable list to keep in sync.
 */
export async function getCategoryUsageMap(): Promise<Record<string, CategoryUsageEntry[]>> {
  const businesses = await Business.find().select("name questionTemplateId parentOrgId");
  const feedbackPoints = await FeedbackPoint.find().select("businessId questionTemplateOverride");

  const overridesByBusiness = new Map<string, Types.ObjectId[]>();
  for (const fp of feedbackPoints) {
    if (!fp.questionTemplateOverride) continue;
    const key = fp.businessId.toString();
    const list = overridesByBusiness.get(key) ?? [];
    list.push(fp.questionTemplateOverride);
    overridesByBusiness.set(key, list);
  }

  const allTemplateIds = new Set<string>();
  for (const b of businesses) if (b.questionTemplateId) allTemplateIds.add(b.questionTemplateId.toString());
  for (const overrides of overridesByBusiness.values()) for (const o of overrides) allTemplateIds.add(o.toString());
  const catsByTemplate = await categoryIdsByTemplateId([...allTemplateIds]);

  const parentOrgIds = [...new Set(businesses.map((b) => b.parentOrgId?.toString()).filter((id): id is string => !!id))];
  const parentOrgs = parentOrgIds.length ? await ParentOrganization.find({ _id: { $in: parentOrgIds } }).select("name") : [];
  const orgNameById = new Map(parentOrgs.map((o) => [o._id.toString(), o.name]));

  const usage: Record<string, CategoryUsageEntry[]> = {};
  for (const business of businesses) {
    const templateIds = effectiveTemplateIdsForBusiness(business, overridesByBusiness.get(business._id.toString()) ?? []);
    const categoryIds = new Set<string>();
    for (const tid of templateIds) for (const c of catsByTemplate.get(tid) ?? []) categoryIds.add(c);

    const parentOrgId = business.parentOrgId?.toString() ?? null;
    for (const categoryId of categoryIds) {
      const list = usage[categoryId] ?? (usage[categoryId] = []);
      list.push({
        businessId: business._id.toString(),
        businessName: business.name,
        parentOrgId,
        parentOrgName: parentOrgId ? (orgNameById.get(parentOrgId) ?? null) : null,
      });
    }
  }
  return usage;
}
