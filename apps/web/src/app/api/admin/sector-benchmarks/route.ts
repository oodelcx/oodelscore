import { NextResponse } from "next/server";
import { connectToDatabase, Business, CxPulseScore } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const MIN_GROUP_SIZE = 3;

/**
 * Anonymized sector benchmarks (OBS11): the average OodelCX Compass/CX
 * Pulse maturity level per industry, computed only from businesses that
 * explicitly opted in (Business.benchmarkOptIn — off by default). An
 * industry group smaller than MIN_GROUP_SIZE is dropped entirely rather
 * than shown with a tiny sample, since a group of 1-2 would make an
 * "anonymized" average trivially attributable back to a real business.
 * Never returns which businesses are in a group, only the aggregate.
 */
export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.businesses.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const optedIn = await Business.find({ benchmarkOptIn: true, industry: { $ne: "" } }).select("_id industry");
  if (optedIn.length === 0) {
    return NextResponse.json({ status: "ok", industries: [], optedInCount: 0, minGroupSize: MIN_GROUP_SIZE });
  }

  const industryByBusinessId = new Map(optedIn.map((b) => [b._id.toString(), b.industry]));
  const businessIds = optedIn.map((b) => b._id);

  // Latest CX Pulse score per business (across products), most recent
  // period first — a business's most recent score is the only one that
  // represents "where they stand today" for a cross-sector comparison.
  const scores = await CxPulseScore.find({ ownerType: "business", ownerId: { $in: businessIds } }).sort({ period: -1 });
  const latestLevelByBusinessId = new Map<string, number>();
  for (const s of scores) {
    const key = s.ownerId.toString();
    if (!latestLevelByBusinessId.has(key)) latestLevelByBusinessId.set(key, s.level);
  }

  const levelsByIndustry = new Map<string, number[]>();
  for (const [businessId, level] of latestLevelByBusinessId) {
    const industry = industryByBusinessId.get(businessId);
    if (!industry) continue;
    const list = levelsByIndustry.get(industry) ?? [];
    list.push(level);
    levelsByIndustry.set(industry, list);
  }

  const industries = Array.from(levelsByIndustry.entries())
    .filter(([, levels]) => levels.length >= MIN_GROUP_SIZE)
    .map(([industry, levels]) => ({
      industry,
      sampleSize: levels.length,
      avgLevel: levels.reduce((sum, l) => sum + l, 0) / levels.length,
    }))
    .sort((a, b) => a.industry.localeCompare(b.industry));

  return NextResponse.json({ status: "ok", industries, optedInCount: optedIn.length, minGroupSize: MIN_GROUP_SIZE });
}
