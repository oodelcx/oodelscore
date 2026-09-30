import { DecisionLogEntry, ClosingLoopUpdate } from "@oodelscore/shared";
import type { Types } from "mongoose";

interface InitiativeLike {
  _id: Types.ObjectId;
  toObject(): Record<string, unknown>;
}

/**
 * Attaches each initiative's linked Decision Log entry (if "Log outcome"
 * was used from it) and that entry's Closing the Loop update (if "Close
 * the loop" was used from it in turn) — the Act-layer chain
 * (Initiative -> Decision -> Closing the Loop) shown inline on the
 * Improvement Initiatives page so a user can see the full thread without
 * hunting across three pages.
 */
export async function attachActChain<T extends InitiativeLike>(initiatives: T[]) {
  if (initiatives.length === 0) return [];

  const ids = initiatives.map((i) => i._id);
  const decisions = await DecisionLogEntry.find({ linkedInitiativeId: { $in: ids } }).select(
    "linkedInitiativeId title status outcomeBefore outcomeAfter outcomeMetricDescription"
  );

  const decisionIds = decisions.map((d) => d._id);
  const closingLoopUpdates = decisionIds.length
    ? await ClosingLoopUpdate.find({ linkedDecisionId: { $in: decisionIds } }).select("linkedDecisionId title status sentAt")
    : [];

  return initiatives.map((initiative) => {
    const decision = decisions.find((d) => d.linkedInitiativeId?.toString() === initiative._id.toString());
    const closingLoop = decision
      ? closingLoopUpdates.find((c) => c.linkedDecisionId?.toString() === decision._id.toString())
      : undefined;

    return {
      ...initiative.toObject(),
      linkedDecision: decision
        ? {
            _id: decision._id.toString(),
            title: decision.title,
            status: decision.status,
            outcomeBefore: decision.outcomeBefore,
            outcomeAfter: decision.outcomeAfter,
            outcomeMetricDescription: decision.outcomeMetricDescription,
            closingLoop: closingLoop
              ? { _id: closingLoop._id.toString(), title: closingLoop.title, status: closingLoop.status, sentAt: closingLoop.sentAt }
              : null,
          }
        : null,
    };
  });
}
