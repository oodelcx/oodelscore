import { NextResponse } from "next/server";
import { connectToDatabase, Invoice, Business, ParentOrganization } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (from || to) {
    const issuedAt: Record<string, Date> = {};
    if (from) issuedAt.$gte = new Date(from);
    if (to) issuedAt.$lte = new Date(to);
    filter.issuedAt = issuedAt;
  }

  const invoices = await Invoice.find(filter).sort({ issuedAt: -1 }).limit(500);

  const businessIds = invoices.filter((i) => i.ownerType === "business").map((i) => i.ownerId);
  const orgIds = invoices.filter((i) => i.ownerType === "parentOrg").map((i) => i.ownerId);
  const [businesses, orgs] = await Promise.all([
    Business.find({ _id: { $in: businessIds } }).select("name"),
    ParentOrganization.find({ _id: { $in: orgIds } }).select("name"),
  ]);
  const nameById = new Map<string, string>([
    ...businesses.map((b) => [b._id.toString(), b.name] as const),
    ...orgs.map((o) => [o._id.toString(), o.name] as const),
  ]);

  const enriched = invoices.map((i) => ({
    ...i.toObject(),
    ownerName: nameById.get(i.ownerId.toString()) ?? "Unknown",
  }));

  return NextResponse.json({ status: "ok", invoices: enriched });
}
