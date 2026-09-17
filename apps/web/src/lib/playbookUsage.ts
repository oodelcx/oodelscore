import { Types } from "mongoose";
import { PlaybookRun } from "@oodelscore/shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const USAGE_WINDOW_DAYS = 90;

export interface PlaybookUsageStats {
  usageCount90d: number;
  completionRate: number | null;
  avgResolutionHours: number | null;
  lastUsedAt: Date | null;
}

/**
 * Scope note: usage is computed across EVERY PlaybookRun for a given
 * playbookId, regardless of which business/org (`ownerId`) ran it — not
 * scoped to a single owner. A parentOrg-level Playbook can be the
 * category-owner-mapping fallback for many businesses under that org (see
 * `autoAttachPlaybook`), each creating its own `ownerType: "business"` run
 * against the same shared `playbookId`; scoping usage to one ownerId alone
 * would undercount a shared playbook's real usage. A business-owned
 * Playbook naturally only ever has runs from that one business anyway, so
 * this scope is a strict superset that's correct either way.
 *
 * completionRate excludes still-active runs: completed / (completed +
 * abandoned), both counted within the 90-day window, null if neither
 * happened yet. avgResolutionHours is the average (completedAt - startedAt)
 * in hours across completed runs in the window, null if none.
 */
export async function computePlaybookUsageBatch(
  playbookIds: (Types.ObjectId | string)[]
): Promise<Map<string, PlaybookUsageStats>> {
  const result = new Map<string, PlaybookUsageStats>();
  if (playbookIds.length === 0) return result;

  const ids = playbookIds.map((id) => new Types.ObjectId(id));
  const since = new Date(Date.now() - USAGE_WINDOW_DAYS * DAY_MS);

  const rows = await PlaybookRun.aggregate([
    { $match: { playbookId: { $in: ids } } },
    {
      $group: {
        _id: "$playbookId",
        lastUsedAt: { $max: "$startedAt" },
        usageCount90d: { $sum: { $cond: [{ $gte: ["$startedAt", since] }, 1, 0] } },
        completed90d: {
          $sum: { $cond: [{ $and: [{ $eq: ["$status", "completed"] }, { $gte: ["$startedAt", since] }] }, 1, 0] },
        },
        abandoned90d: {
          $sum: { $cond: [{ $and: [{ $eq: ["$status", "abandoned"] }, { $gte: ["$startedAt", since] }] }, 1, 0] },
        },
        resolutionHoursSum90d: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "completed"] },
                  { $gte: ["$startedAt", since] },
                  { $ne: ["$completedAt", null] },
                ],
              },
              { $divide: [{ $subtract: ["$completedAt", "$startedAt"] }, HOUR_MS] },
              0,
            ],
          },
        },
      },
    },
  ]);

  for (const row of rows) {
    const finished = row.completed90d + row.abandoned90d;
    result.set(row._id.toString(), {
      usageCount90d: row.usageCount90d,
      completionRate: finished > 0 ? Math.round((row.completed90d / finished) * 100) / 100 : null,
      avgResolutionHours:
        row.completed90d > 0 ? Math.round((row.resolutionHoursSum90d / row.completed90d) * 10) / 10 : null,
      lastUsedAt: row.lastUsedAt ?? null,
    });
  }

  return result;
}

const EMPTY_USAGE: PlaybookUsageStats = {
  usageCount90d: 0,
  completionRate: null,
  avgResolutionHours: null,
  lastUsedAt: null,
};

export async function computePlaybookUsageOne(playbookId: Types.ObjectId | string): Promise<PlaybookUsageStats> {
  const batch = await computePlaybookUsageBatch([playbookId]);
  return batch.get(playbookId.toString()) ?? EMPTY_USAGE;
}

/** Count of runs (any status) for this same playbookId + ownerId in the last 30 days — feeds the pattern nudge. */
export async function countOwnerRunsLast30d(
  playbookId: Types.ObjectId | string,
  ownerId: Types.ObjectId | string
): Promise<number> {
  const since = new Date(Date.now() - 30 * DAY_MS);
  return PlaybookRun.countDocuments({ playbookId, ownerId, startedAt: { $gte: since } });
}
