import { NextResponse } from "next/server";
import { connectToDatabase, RecurringIssueFlag, Category, ActionBoardItem, ImprovementInitiative } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();

  const flag = await RecurringIssueFlag.findOne({
    _id: id,
    ownerScope: "parentOrg",
    ownerScopeId: session.org._id,
    status: "active",
  });
  if (!flag) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const category = await Category.findById(flag.categoryId);
  const categoryName = category?.name ?? "recurring issue";
  const cases = await ActionBoardItem.find({ _id: { $in: flag.caseIds } }).select("title");
  const baselineCount = cases.length;

  const initiative = await ImprovementInitiative.create({
    parentOrgId: session.org._id,
    title: `Reduce ${categoryName} — ${session.org.name} (${flag.businessIds.length} branches)`,
    description: `Auto-suggested from a cross-branch recurring pattern: ${flag.count} "${categoryName}" cases across ${flag.businessIds.length} branches in the last ${flag.windowDays} days.`,
    affectedBusinessIds: flag.businessIds,
    linkedActionIds: flag.caseIds,
    baselineMetricDescription: `Number of "${categoryName}" cases per ${flag.windowDays} days, across affected branches`,
    baselineValue: baselineCount,
    targetValue: null,
    startedAt: new Date(),
  });

  flag.status = "converted";
  flag.convertedInitiativeId = initiative._id;
  await flag.save();

  return NextResponse.json({ status: "ok", initiative });
}
