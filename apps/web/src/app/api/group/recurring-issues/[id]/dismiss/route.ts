import { NextResponse } from "next/server";
import { connectToDatabase, RecurringIssueFlag } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();

  const flag = await RecurringIssueFlag.findOneAndUpdate(
    { _id: id, ownerScope: "parentOrg", ownerScopeId: session.org._id, status: "active" },
    { $set: { status: "dismissed", dismissedAt: new Date() } },
    { new: true }
  );
  if (!flag) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
