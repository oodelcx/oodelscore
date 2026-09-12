import { NextResponse } from "next/server";
import { connectToDatabase, User, ParentOrganization } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * "Messages" in the mockup is a static contact card, not a chat feature —
 * there's no message model in the spec. Shows the assigned account manager
 * (accountManagerId) and, for a branch, the parent org's own contact too.
 */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const accountManager = session.business.accountManagerId ? await User.findById(session.business.accountManagerId) : null;

  let groupContact: { name: string; email: string } | null = null;
  if (session.business.parentOrgId) {
    const org = await ParentOrganization.findById(session.business.parentOrgId);
    if (org) groupContact = { name: org.contactName || org.name, email: org.contactEmail };
  }

  return NextResponse.json({
    status: "ok",
    accountManager: accountManager ? { email: accountManager.email } : null,
    groupContact,
  });
}
