import { NextResponse } from "next/server";
import { connectToDatabase, seedShowcaseData, generateDueInsights, ALL_AI_REPORT_PERIODS } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Fills the database with a realistic multi-organization showcase (a bank
 * group, a telecom, a school trust, an airline, a hospital network, and
 * standalone businesses spanning Customer Experience, Colleague Experience,
 * and both) so a new Admin can click through every page and see real,
 * connected data instead of empty states. Also generates AI Insight Reports
 * for every owner across every cadence against the data just seeded — via
 * the live Claude API when ANTHROPIC_API_KEY is set, falling back to a
 * deterministic narrative otherwise (see ai/insightsGeneration.ts). Gated
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
  const insights = await generateDueInsights(new Date(), [...ALL_AI_REPORT_PERIODS]);
  return NextResponse.json({ status: "ok", result, insights });
}
