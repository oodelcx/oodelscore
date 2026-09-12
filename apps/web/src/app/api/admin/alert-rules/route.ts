import { NextResponse } from "next/server";
import { connectToDatabase, AlertRule, Business, ParentOrganization } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Admin gets "view all (oversight)" only on Alert Rules per spec Section 4
 * — there is deliberately no POST/PATCH/DELETE here. Editing belongs to the
 * Business owner (their own rules) or Parent Org owner (own + cascade).
 */
export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.businesses.view && !session.role.permissions.parentOrgs.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const rules = await AlertRule.find().sort({ createdAt: -1 });

  const businessIds = rules.filter((r) => r.scope === "business").map((r) => r.ownerId);
  const orgIds = rules.filter((r) => r.scope !== "business").map((r) => r.ownerId);
  const [businesses, orgs] = await Promise.all([
    Business.find({ _id: { $in: businessIds } }).select("name contactEmail"),
    ParentOrganization.find({ _id: { $in: orgIds } }).select("name contactEmail"),
  ]);
  const businessById = new Map(businesses.map((b) => [b._id.toString(), b]));
  const orgById = new Map(orgs.map((o) => [o._id.toString(), o]));

  // Spec Section 13 bug #4: a recipient shared verbatim across rules for
  // *different* owners looks like a stray default silently CC'd on every
  // alert, rather than a real per-business contact — flag it for review.
  const ownerIdsByRecipient = new Map<string, Set<string>>();
  for (const rule of rules) {
    for (const recipient of rule.recipients) {
      const key = recipient.trim().toLowerCase();
      if (!key) continue;
      const owners = ownerIdsByRecipient.get(key) ?? new Set<string>();
      owners.add(rule.ownerId.toString());
      ownerIdsByRecipient.set(key, owners);
    }
  }
  const suspiciousRecipients = new Set(
    [...ownerIdsByRecipient.entries()].filter(([, owners]) => owners.size > 1).map(([recipient]) => recipient)
  );

  const enriched = rules.map((r) => {
    const owner = r.scope === "business" ? businessById.get(r.ownerId.toString()) : orgById.get(r.ownerId.toString());
    return {
      ...r.toObject(),
      ownerName: owner?.name ?? "Unknown",
      ownerType: r.scope === "business" ? "business" : "parentOrg",
      suspiciousRecipients: r.recipients.filter((rec) => suspiciousRecipients.has(rec.trim().toLowerCase())),
    };
  });

  return NextResponse.json({ status: "ok", rules: enriched });
}
