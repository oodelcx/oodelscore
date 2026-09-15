import { Types } from "mongoose";
import { Response } from "../models/Response";
import { Category } from "../models/Category";
import type { IPlaybook } from "../models/Playbook";
import { computeCategoryAverage } from "./goals";

const CATEGORY_AVERAGE_WINDOW_DAYS = 30;
const DEFAULT_MENTION_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PlaybookTriggerStatus {
  isTriggered: boolean;
  currentValue: number | null;
  description: string;
}

async function countNegativeMentions(businessIds: Types.ObjectId[], categoryId: Types.ObjectId | null, windowDays: number, now: Date): Promise<number> {
  const from = new Date(now.getTime() - windowDays * DAY_MS);
  const filter: Record<string, unknown> = { businessId: { $in: businessIds }, submittedAt: { $gte: from, $lte: now }, sentiment: "negative" };
  if (categoryId) filter["answers.categoryId"] = categoryId;
  return Response.countDocuments(filter);
}

/**
 * CX intelligence roadmap Phase 4 — turns a playbook's trigger from
 * descriptive text into something actually checked against real data.
 * Returns null when the playbook has no structured trigger configured
 * (triggerMetric unset), which is a valid, supported state — the playbook
 * still works purely as a checklist template. Pure computation, no AI.
 */
export async function evaluatePlaybookTrigger(
  playbook: Pick<IPlaybook, "triggerMetric" | "triggerComparator" | "triggerThreshold" | "triggerWindowDays" | "categoryId">,
  businessIds: (Types.ObjectId | string)[],
  now: Date = new Date()
): Promise<PlaybookTriggerStatus | null> {
  if (!playbook.triggerMetric || playbook.triggerThreshold === null || businessIds.length === 0) return null;
  const ids = businessIds.map((id) => new Types.ObjectId(id));

  if (playbook.triggerMetric === "categoryAverage") {
    if (!playbook.categoryId) return null;
    const from = new Date(now.getTime() - CATEGORY_AVERAGE_WINDOW_DAYS * DAY_MS);
    const average = await computeCategoryAverage(ids, playbook.categoryId, from, now);
    if (average === null) return { isTriggered: false, currentValue: null, description: "Not enough data in the last 30 days yet" };

    const comparator = playbook.triggerComparator ?? "below";
    const isTriggered = comparator === "below" ? average < playbook.triggerThreshold : average > playbook.triggerThreshold;
    const category = await Category.findById(playbook.categoryId).select("name");
    return {
      isTriggered,
      currentValue: average,
      description: `${category?.name ?? "This category"} averaging ${average} over the last ${CATEGORY_AVERAGE_WINDOW_DAYS} days`,
    };
  }

  // negativeMentionCount
  const windowDays = playbook.triggerWindowDays ?? DEFAULT_MENTION_WINDOW_DAYS;
  const count = await countNegativeMentions(ids, playbook.categoryId, windowDays, now);
  const isTriggered = count >= playbook.triggerThreshold;
  return {
    isTriggered,
    currentValue: count,
    description: `${count} negative-sentiment response${count === 1 ? "" : "s"} in the last ${windowDays} days`,
  };
}
