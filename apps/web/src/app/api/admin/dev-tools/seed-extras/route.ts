import { NextResponse } from "next/server";
import { connectToDatabase, seedLaunchDemoExtras, seedShowcasePolish } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Adds the colleague flows (personal-link pulse, day-30/day-90/exit surveys,
 * confidential cases) and the showcase polish (escalation assignments,
 * business value inputs, case trails, goals, playbooks) on top of whatever
 * showcase data already exists. Both seeds find-or-create every row by a
 * stable key, so this is safe to press more than once and never wipes
 * anything. Same gating as seed-showcase.
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
  const polish = await seedShowcasePolish();
  const launch = await seedLaunchDemoExtras();
  return NextResponse.json({ status: "ok", polish, launch });
}
