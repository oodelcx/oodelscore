import { NextResponse } from "next/server";
import { connectToDatabase, wipeAllTenantData } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Deletes every tenant-scoped document (businesses, orgs, their logins,
 * feedback, alerts, the Act layer, billing, requests) so Admin can start
 * filling in real data from a clean slate. Keeps admin_staff logins and
 * platform config (Roles, Email Templates, Site Content, CX Pulse
 * framework). Gated the same as seed-showcase — never available unless
 * ENABLE_DEV_DATA_TOOLS=true, and only for the "Admin" system role.
 */
export async function POST(request: Request) {
  if (process.env.ENABLE_DEV_DATA_TOOLS !== "true") {
    return NextResponse.json({ status: "error", message: "Dev Data Tools are not enabled in this environment" }, { status: 403 });
  }
  const session = await requireStaffSession();
  if (!session || session.role.name !== "Admin") {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (body?.confirm !== "DELETE ALL DATA") {
    return NextResponse.json(
      { status: "error", message: 'Type "DELETE ALL DATA" exactly to confirm this action.' },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const counts = await wipeAllTenantData();
  return NextResponse.json({ status: "ok", counts });
}
