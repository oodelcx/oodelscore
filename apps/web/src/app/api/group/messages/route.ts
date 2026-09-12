import { NextResponse } from "next/server";
import { connectToDatabase, User } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const accountManager = session.org.accountManagerId ? await User.findById(session.org.accountManagerId) : null;

  return NextResponse.json({
    status: "ok",
    accountManager: accountManager ? { email: accountManager.email } : null,
  });
}
