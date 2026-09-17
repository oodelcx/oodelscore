import type { HydratedDocument } from "mongoose";
import { Playbook } from "../models/Playbook";
import { PlaybookRun } from "../models/PlaybookRun";
import { Category } from "../models/Category";
import type { IActionBoardItem } from "../models/ActionBoardItem";
import { evaluatePlaybookTrigger } from "./playbookTrigger";

/**
 * Case Management auto-attach (CX intelligence roadmap): the moment a Case
 * (ActionBoardItem) is created — whether auto-created by an Alert Rule
 * firing or manually logged by a user — if its category has a matching
 * Playbook, a PlaybookRun for that playbook is attached immediately, with
 * its checklist already visible. Only the *attaching* is automatic; the
 * checklist steps still get manually checked off by a human.
 *
 * Mirrors the same business-then-parentOrg category-owner-mapping fallback
 * `autoTriageAndCreateActionItem` (alerts/evaluate.ts) already uses: a
 * branch's own Playbook for the category wins if one exists, and only when
 * it doesn't AND the item belongs to a parent org do we fall back to the
 * org-wide Playbook for that category. No Playbook for the category at all
 * is a normal, supported state — most categories won't have one yet.
 */
export async function autoAttachPlaybook(item: HydratedDocument<IActionBoardItem>): Promise<void> {
  if (!item.categoryId) return;

  const businessPlaybook = await Playbook.findOne({ businessId: item.businessId, categoryId: item.categoryId });
  const playbook =
    businessPlaybook ??
    (item.parentOrgId ? await Playbook.findOne({ parentOrgId: item.parentOrgId, categoryId: item.categoryId }) : null);

  if (!playbook) return;

  // The run's owner scope must match whichever Playbook actually matched —
  // not always "business". A branch's own case can attach the org-wide
  // fallback Playbook, and that run then belongs to the parentOrg, not the
  // branch: /api/group/playbook-runs/[id] looks it up by
  // {ownerType:"parentOrg", ownerId: org._id}, so a run mis-tagged
  // ownerType:"business" 404s there ("Couldn't load this playbook run")
  // even though the case card's chip (which doesn't filter by owner) shows
  // it fine — that mismatch is exactly what this fixes.
  const ownerType = businessPlaybook ? "business" : "parentOrg";
  const ownerId = businessPlaybook ? item.businessId : item.parentOrgId!;

  // Defensive: this only ever runs once, right after ActionBoardItem.create,
  // but guard against a double-call (or a future second call site) ever
  // creating two active runs for the same case.
  const existing = await PlaybookRun.findOne({ actionBoardItemId: item._id, status: "active" });
  if (existing) return;

  const triggerStatus = await evaluatePlaybookTrigger(playbook, [item.businessId]);
  let attachReason: string;
  if (triggerStatus) {
    attachReason = `Auto-attached — ${triggerStatus.description}.`;
  } else {
    const category = await Category.findById(item.categoryId).select("name");
    attachReason = `Auto-attached — this is the standard playbook for ${category?.name ?? "this"} cases.`;
  }

  await PlaybookRun.create({
    playbookId: playbook._id,
    ownerType,
    ownerId,
    actionBoardItemId: item._id,
    steps: playbook.steps,
    completedStepIndexes: [],
    status: "active",
    attachReason,
  });
}
