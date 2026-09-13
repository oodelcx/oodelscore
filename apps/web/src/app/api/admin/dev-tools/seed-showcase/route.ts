import { NextResponse } from "next/server";
import { connectToDatabase, seedShowcaseData } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Fills the database with a realistic multi-sector showcase (a bank group
 * with branches, a school trust, a diagnostics lab group, a retail chain,
 * and a handful of standalone businesses) so a new Admin can click through
 * every page and see real, connected data instead of empty states. Gated
 * behind ENABLE_DEV_DATA_TOOLS=true and the "Admin" system role — never
 * available unless the deploying environment explicitly opts in.
 */
export async function POST() {
  if (process.env.ENABLE_DEV_DATA_TOOLS !== "true") {
    return NextResponse.json({ status: "error", message: "Dev Data Tools are not enabled in this environment" }, { status: 403 });
  }
  const session = await requireStaffSession();
  if (!session || session.role.name !== "Admin") {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const result = await seedShowcaseData(session.user._id);
  return NextResponse.json({ status: "ok", result });
}
