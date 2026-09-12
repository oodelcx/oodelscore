import { NextResponse } from "next/server";
import { connectToDatabase, Business, Response } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id name");
  const businessNameById = new Map(businesses.map((b) => [b._id.toString(), b.name]));

  const responses = await Response.find({ businessId: { $in: businesses.map((b) => b._id) } })
    .sort({ submittedAt: -1 })
    .limit(200);

  const enriched = responses.map((r) => ({ ...r.toObject(), businessName: businessNameById.get(r.businessId.toString()) ?? "Unknown" }));

  return NextResponse.json({ status: "ok", responses: enriched });
}
