import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Playbook,
  Category,
  PlaybookRun,
  evaluatePlaybookTrigger,
  PLAYBOOK_TRIGGER_METRICS,
  PLAYBOOK_TRIGGER_COMPARATORS,
  hasFeature,
} from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { computePlaybookUsageBatch } from "@/lib/playbookUsage";

// Mirrors /api/group/playbooks, scoped to businessId instead of
// parentOrgId. Not available to limited-tier team members.
//
// Playbook authorship rule (product decision, matching the spec's original
// "Decision Log / Playbooks: Business — none, Parent Org — full" intent,
// with the one necessary carve-out the spec's own Section 16 already
// established for the Act layer): a STANDALONE business (no parentOrgId)
// has nowhere else for a playbook to come from, so it keeps full CRUD here
// — same reasoning Section 16 used to give standalone businesses their own
// Action Board. A BRANCH of a group already has a parent org that can
// author one, so its own playbook authoring is disabled; it sees the
// org's playbooks read-only (readOnly:true below) and interacts with them
// by checking off steps on its own cases in Case Management, same as
// before — Group already sees that live via GET /api/group/playbook-runs.
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "playbooks" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "playbooks")) {
    return NextResponse.json({ status: "error", message: "Playbook Library is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const isBranch = !!session.business.parentOrgId;

  const [playbooks, categories] = await Promise.all([
    isBranch
      ? Playbook.find({ parentOrgId: session.business.parentOrgId }).sort({ createdAt: -1 })
      : Playbook.find({ businessId: session.business._id }).sort({ createdAt: -1 }),
    Category.find().sort({ name: 1 }),
  ]);

  const activeRuns = await PlaybookRun.find({
    playbookId: { $in: playbooks.map((p) => p._id) },
    ownerType: "business",
    ownerId: session.business._id,
    status: "active",
  });
  const activeRunByPlaybookId = new Map(activeRuns.map((r) => [r.playbookId.toString(), r]));
  const usageByPlaybookId = await computePlaybookUsageBatch(playbooks.map((p) => p._id));

  const enriched = await Promise.all(
    playbooks.map(async (playbook) => ({
      ...playbook.toObject(),
      triggerStatus: await evaluatePlaybookTrigger(playbook, [session.business._id]),
      activeRun: activeRunByPlaybookId.get(playbook._id.toString()) ?? null,
      usage: usageByPlaybookId.get(playbook._id.toString()) ?? {
        usageCount90d: 0,
        completionRate: null,
        avgResolutionHours: null,
        lastUsedAt: null,
      },
    }))
  );

  return NextResponse.json({ status: "ok", playbooks: enriched, categories, readOnly: isBranch });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "playbooks" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "playbooks")) {
    return NextResponse.json({ status: "error", message: "Playbook Library is not enabled for this account" }, { status: 403 });
  }
  if (session.business.parentOrgId) {
    return NextResponse.json(
      { status: "error", message: "Playbooks for a branch are managed by your parent organization." },
      { status: 403 }
    );
  }

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ status: "error", message: "title is required" }, { status: 400 });

  const triggerMetric = PLAYBOOK_TRIGGER_METRICS.includes(body?.triggerMetric) ? body.triggerMetric : null;
  const triggerComparator = PLAYBOOK_TRIGGER_COMPARATORS.includes(body?.triggerComparator) ? body.triggerComparator : null;
  const triggerThreshold = typeof body?.triggerThreshold === "number" ? body.triggerThreshold : null;
  const triggerWindowDays = typeof body?.triggerWindowDays === "number" ? body.triggerWindowDays : null;

  const playbook = await Playbook.create({
    businessId: session.business._id,
    title,
    categoryId: typeof body?.categoryId === "string" ? body.categoryId : null,
    triggerCondition: typeof body?.triggerCondition === "string" ? body.triggerCondition : "",
    triggerMetric,
    triggerComparator,
    triggerThreshold,
    triggerWindowDays,
    steps: Array.isArray(body?.steps) ? body.steps.filter((s: unknown) => typeof s === "string") : [],
    escalationContactId: typeof body?.escalationContactId === "string" ? body.escalationContactId : null,
  });

  return NextResponse.json({ status: "ok", playbook }, { status: 201 });
}
