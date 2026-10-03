import { NextResponse } from "next/server";
import { connectToDatabase, RecurringIssueFlag } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/** "Not worth an initiative" — the next sweep re-raises it if the pattern keeps going. */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();

  const flag = await RecurringIssueFlag.findOneAndUpdate(
    { _id: id, ownerScope: "business", ownerScopeId: session.business._id, status: "active" },
    { $set: { status: "dismissed", dismissedAt: new Date() } },
    { new: true }
  );
  if (!flag) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
