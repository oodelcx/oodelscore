import { NextResponse } from "next/server";
import { connectToDatabase, Business, Category, CategoryOwnerMapping, CxPulseScore, Playbook } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

const DIMENSION_KEYS = ["awareness", "response", "ownership", "culture", "outcome"] as const;
// Rough "healthy" floor per dimension used only to compute the "what would
// move you up" checklist below — not a spec threshold, just a legible bar
// for surfacing which dimension is holding the composite back.
const HEALTHY_DIMENSION_FLOOR = 70;

export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const score = await CxPulseScore.findOne({ ownerType: "parentOrg", ownerId: session.org._id }).sort({ period: -1 });
  const history = await CxPulseScore.find({ ownerType: "parentOrg", ownerId: session.org._id }).sort({ period: -1 }).limit(6);

  const businesses = await Business.find({ parentOrgId: session.org._id, active: true }).select("name region").sort({ name: 1 });
  const businessScores = await Promise.all(
    businesses.map((b) => CxPulseScore.findOne({ ownerType: "business", ownerId: b._id }).sort({ period: -1 }))
  );
  const branches = businesses.map((b, i) => ({
    businessId: b._id.toString(),
    name: b.name,
    region: b.region ?? null,
    compositeScore: businessScores[i]?.compositeScore ?? null,
    level: businessScores[i]?.level ?? null,
  }));

  const scoredBranches = businessScores.filter((s): s is NonNullable<typeof s> => s !== null);
  const groupAvgDimensions = Object.fromEntries(
    DIMENSION_KEYS.map((key) => [
      key,
      scoredBranches.length === 0 ? null : Math.round(scoredBranches.reduce((sum, s) => sum + s.dimensions[key], 0) / scoredBranches.length),
    ])
  );

  // "What would move you to the next level" — real conditions, not copy.
  const checklist: { label: string; done: boolean }[] = [];

  const totalCategories = await Category.countDocuments();
  const mappedCategoryIds = await CategoryOwnerMapping.distinct("categoryId", { ownerScope: "parentOrg", ownerScopeId: session.org._id });
  checklist.push({
    label:
      totalCategories === 0
        ? "Set a default owner for your categories"
        : `Every category has a default owner — ${mappedCategoryIds.length}/${totalCategories} mapped`,
    done: totalCategories > 0 && mappedCategoryIds.length >= totalCategories,
  });

  if (score) {
    for (const key of DIMENSION_KEYS) {
      const value = score.dimensions[key];
      if (value < HEALTHY_DIMENSION_FLOOR) {
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        checklist.push({ label: `Bring ${label} above ${HEALTHY_DIMENSION_FLOOR} — currently ${value}`, done: false });
      }
    }
  }

  const playbooks = await Playbook.find({ parentOrgId: session.org._id }).select("usageCount");
  const totalPlaybookUsage = playbooks.reduce((sum, p) => sum + p.usageCount, 0);
  checklist.push({
    label: playbooks.length === 0 ? "Create at least one playbook" : "Get at least one branch using a playbook",
    done: totalPlaybookUsage > 0,
  });

  return NextResponse.json({ status: "ok", score, history, branches, groupAvgDimensions, checklist });
}
