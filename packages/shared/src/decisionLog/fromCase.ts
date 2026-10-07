import type { Types } from "mongoose";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { Category } from "../models/Category";
import { DecisionLogEntry } from "../models/DecisionLogEntry";
import { logApiRouteError } from "../observability/systemHealth";

/**
 * When a case is resolved, record it in the Decision Log as a DRAFT. The
 * draft is clearly marked auto-created and is never measured or counted as a
 * real decision until a person confirms it (the confirm action clears
 * isDraft). One entry per case: sourceCaseId is unique, so resolving,
 * reopening and resolving again never creates a second entry.
 *
 * Ownership follows the existing Decision Log rule: a branch's decisions live
 * under its parent org (parentOrgId set, businessId null); a standalone
 * business's live under its own businessId.
 *
 * Never throws — a Decision Log problem must not stop a case being resolved.
 * Failures go to the system health log instead.
 */
export async function ensureDraftDecisionForResolvedCase(params: {
  caseId: Types.ObjectId;
  actorUserId: Types.ObjectId | null;
  actorLabel: string;
}): Promise<void> {
  try {
    const item = await ActionBoardItem.findById(params.caseId);
    if (!item || item.status !== "resolved") return;

    const existing = await DecisionLogEntry.findOne({ sourceCaseId: item._id }).select("_id");
    if (existing) return;

    const category = item.categoryId ? await Category.findById(item.categoryId).select("name") : null;

    // A sensitive case's feedback must not be linkable from the Decision Log,
    // which a wider group of people can read.
    const responseIds = item.sensitive ? [] : item.sourceResponseIds;

    // A sensitive case's description IS the confidential comment: it must
    // never be copied into the Decision Log, which more people can read.
    const triggerParts = [
      item.sensitive ? "A confidential concern was raised and resolved by its designated contact." : item.description?.trim() || item.title,
      category ? `Category: ${category.name}.` : "",
      responseIds.length > 0 ? `Based on ${responseIds.length} piece${responseIds.length === 1 ? "" : "s"} of feedback.` : "",
      item.sensitive ? "Raised from a sensitive comment; the feedback is not linked here." : "",
    ].filter(Boolean);

    const isBranch = !!item.parentOrgId;
    await DecisionLogEntry.create({
      parentOrgId: isBranch ? item.parentOrgId : null,
      businessId: isBranch ? null : item.businessId,
      product: item.product,
      autoCreated: true,
      isDraft: true,
      sourceCaseId: item._id,
      sourceResponseIds: responseIds,
      title: item.sensitive ? "Resolved: a confidential concern" : `Resolved: ${item.title}`,
      trigger: triggerParts.join(" "),
      linkedActionIds: [item._id],
      affectedBusinessIds: [item.businessId],
      ownerId: item.ownerId ?? params.actorUserId,
      status: "planned",
      notes: item.resolutionNote?.trim() && !item.sensitive
        ? [{ text: `Resolution note: ${item.resolutionNote.trim()}`, authorLabel: params.actorLabel || "System", createdAt: new Date() }]
        : [],
    });
  } catch (err) {
    // E11000 = a concurrent resolve already created the entry; that is fine.
    if ((err as { code?: number })?.code === 11000) return;
    await logApiRouteError("decision-log/auto-draft-from-case", err, { caseId: params.caseId.toString() });
  }
}
