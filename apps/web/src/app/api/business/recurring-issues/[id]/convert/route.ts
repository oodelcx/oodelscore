import { NextResponse } from "next/server";
import { connectToDatabase, RecurringIssueFlag, Category, ActionBoardItem, ImprovementInitiative } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Turns an active recurring-issue flag into a draft Improvement Initiative,
 * pre-filled from the flag's own evidence (title, baseline, linked cases)
 * — the person still reviews and sets a target before it's a real plan.
 * Only a business-scope flag owned by this exact business can be converted
 * here; a cross-branch (parentOrg-scope) flag is the org's call, not a
 * single branch's — see /api/group/recurring-issues/[id]/convert.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();

  const flag = await RecurringIssueFlag.findOne({
    _id: id,
    ownerScope: "business",
    ownerScopeId: session.business._id,
    status: "active",
  });
  if (!flag) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const category = await Category.findById(flag.categoryId);
  const categoryName = category?.name ?? "recurring issue";

  const cases = await ActionBoardItem.find({ _id: { $in: flag.caseIds } }).select("title");
  const baselineCount = cases.length;

  const initiative = await ImprovementInitiative.create({
    businessId: session.business._id,
    product: category?.product ?? "customer_experience",
    title: `Reduce ${categoryName} — ${session.business.name}`,
    description: `Auto-suggested from a recurring pattern: ${flag.count} "${categoryName}" cases in the last ${flag.windowDays} days.`,
    affectedBusinessIds: [session.business._id],
    linkedActionIds: flag.caseIds,
    baselineMetricDescription: `Number of "${categoryName}" cases per ${flag.windowDays} days`,
    baselineValue: baselineCount,
    targetValue: null,
    startedAt: new Date(),
  });

  flag.status = "converted";
  flag.convertedInitiativeId = initiative._id;
  await flag.save();

  return NextResponse.json({ status: "ok", initiative });
}
