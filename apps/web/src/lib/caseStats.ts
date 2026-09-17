import type { HydratedDocument } from "mongoose";
import { PlaybookRun, type IActionBoardItem, type IPlaybook, type IPlaybookRun } from "@oodelscore/shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface CaseStats {
  open: number;
  inProgress: number;
  overdue: number;
  escalated: number;
  resolved30d: number;
  avgResolutionHours: number | null;
}

export interface CasePlaybookRunSummary {
  id: string;
  playbookId: string;
  playbookTitle: string;
  categoryId: string | null;
  stepsTotal: number;
  stepsCompleted: number;
  status: IPlaybookRun["status"];
  attachReason: string;
}

/**
 * Computes Case Management summary stats from an already-fetched list of
 * ActionBoardItems — no extra query needed, these are simple filters/counts
 * over the array the caller already has, except avgResolutionHours which
 * needs the "resolved in the last 30 days" subset specifically.
 */
export function buildCaseStats(items: HydratedDocument<IActionBoardItem>[]): CaseStats {
  const now = Date.now();
  const cutoff = now - 30 * DAY_MS;

  let open = 0;
  let inProgress = 0;
  let overdue = 0;
  let escalated = 0;
  let resolved30d = 0;
  let resolutionHoursSum = 0;

  for (const item of items) {
    if (item.status === "open") open++;
    if (item.status === "in_progress") inProgress++;
    if (item.status !== "resolved" && item.dueDate && item.dueDate.getTime() < now) overdue++;
    if (item.escalated) escalated++;
    if (item.status === "resolved" && item.resolvedAt && item.resolvedAt.getTime() >= cutoff) {
      resolved30d++;
      resolutionHoursSum += (item.resolvedAt.getTime() - item.createdAt.getTime()) / HOUR_MS;
    }
  }

  return {
    open,
    inProgress,
    overdue,
    escalated,
    resolved30d,
    avgResolutionHours: resolved30d > 0 ? Math.round((resolutionHoursSum / resolved30d) * 10) / 10 : null,
  };
}

/**
 * Batch-fetches every PlaybookRun linked to the given items (one query, not
 * N+1) and returns the items each carrying a `playbookRun` field: the
 * item's current active run if one exists, else its most recently
 * completed/abandoned run if one exists (so a resolved case can still show
 * "view playbook run"), else null.
 */
export async function attachPlaybookRunsToItems(
  items: HydratedDocument<IActionBoardItem>[],
  playbooks: HydratedDocument<IPlaybook>[]
): Promise<(Record<string, unknown> & { playbookRun: CasePlaybookRunSummary | null })[]> {
  if (items.length === 0) return [];

  const playbookById = new Map(playbooks.map((p) => [p._id.toString(), p]));
  const runs = await PlaybookRun.find({ actionBoardItemId: { $in: items.map((i) => i._id) } }).sort({
    startedAt: -1,
  });

  const runsByItemId = new Map<string, HydratedDocument<IPlaybookRun>[]>();
  for (const run of runs) {
    if (!run.actionBoardItemId) continue;
    const key = run.actionBoardItemId.toString();
    const list = runsByItemId.get(key) ?? [];
    list.push(run);
    runsByItemId.set(key, list);
  }

  function toSummary(run: HydratedDocument<IPlaybookRun>): CasePlaybookRunSummary {
    const playbook = playbookById.get(run.playbookId.toString());
    return {
      id: run._id.toString(),
      playbookId: run.playbookId.toString(),
      playbookTitle: playbook?.title ?? "Playbook",
      categoryId: playbook?.categoryId ? playbook.categoryId.toString() : null,
      stepsTotal: run.steps.length,
      stepsCompleted: run.completedStepIndexes.length,
      status: run.status,
      attachReason: run.attachReason,
    };
  }

  return items.map((item) => {
    const itemRuns = runsByItemId.get(item._id.toString()) ?? [];
    const active = itemRuns.find((r) => r.status === "active");
    // itemRuns is sorted by startedAt desc, so the first non-active entry is
    // the most recently finished one.
    const mostRecentFinished = itemRuns.find((r) => r.status !== "active");
    const chosen = active ?? mostRecentFinished ?? null;
    return { ...item.toObject(), playbookRun: chosen ? toSummary(chosen) : null };
  });
}
