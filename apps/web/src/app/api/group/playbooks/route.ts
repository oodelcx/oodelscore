import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Playbook,
  Business,
  PlaybookRun,
  evaluatePlaybookTrigger,
  PLAYBOOK_TRIGGER_METRICS,
  PLAYBOOK_TRIGGER_COMPARATORS,
  hasFeature,
  PRODUCTS,
  type Product,
} from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";
import { computePlaybookUsageBatch } from "@/lib/playbookUsage";

const PRODUCT_SET: readonly string[] = PRODUCTS;

export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "playbooks" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "playbooks")) {
    return NextResponse.json({ status: "error", message: "Playbook Library is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  // Both products' playbooks together, same "show all, badge by product"
  // convention Alert Rules already uses.
  const [playbooks, businesses] = await Promise.all([
    Playbook.find({ parentOrgId: session.org._id }).sort({ createdAt: -1 }),
    Business.find({ parentOrgId: session.org._id }).select("_id"),
  ]);
  const businessIds = businesses.map((b) => b._id);

  const activeRuns = await PlaybookRun.find({
    playbookId: { $in: playbooks.map((p) => p._id) },
    ownerType: "parentOrg",
    ownerId: session.org._id,
    status: "active",
  });
  const activeRunByPlaybookId = new Map(activeRuns.map((r) => [r.playbookId.toString(), r]));
  const usageByPlaybookId = await computePlaybookUsageBatch(playbooks.map((p) => p._id));

  const enriched = await Promise.all(
    playbooks.map(async (playbook) => ({
      ...playbook.toObject(),
      triggerStatus: await evaluatePlaybookTrigger(playbook, businessIds),
      activeRun: activeRunByPlaybookId.get(playbook._id.toString()) ?? null,
      usage: usageByPlaybookId.get(playbook._id.toString()) ?? {
        usageCount90d: 0,
        completionRate: null,
        avgResolutionHours: null,
        lastUsedAt: null,
      },
    }))
  );

  // Playbooks themselves stay unfiltered by product (see the comment
  // above), but the "New playbook" form still needs to know which product
  // tab is active so it doesn't silently default to Customer Experience —
  // resolve and return it the same way every other product-scoped route
  // already does.
  const product = await resolveViewProduct(session.org);

  return NextResponse.json({ status: "ok", playbooks: enriched, product });
}

export async function POST(request: Request) {
  const session = await requireParentOrgOwner({ requirePage: "playbooks" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "playbooks")) {
    return NextResponse.json({ status: "error", message: "Playbook Library is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ status: "error", message: "title is required" }, { status: 400 });

  const triggerMetric = PLAYBOOK_TRIGGER_METRICS.includes(body?.triggerMetric) ? body.triggerMetric : null;
  const triggerComparator = PLAYBOOK_TRIGGER_COMPARATORS.includes(body?.triggerComparator) ? body.triggerComparator : null;
  const triggerThreshold = typeof body?.triggerThreshold === "number" ? body.triggerThreshold : null;
  const triggerWindowDays = typeof body?.triggerWindowDays === "number" ? body.triggerWindowDays : null;
  const product: Product = typeof body?.product === "string" && PRODUCT_SET.includes(body.product) ? (body.product as Product) : "customer_experience";

  const playbook = await Playbook.create({
    parentOrgId: session.org._id,
    product,
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
