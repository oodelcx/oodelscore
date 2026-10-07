import { NextResponse } from "next/server";
import { connectToDatabase, computeAttentionCentre, hasFeature, type AttentionItem, type FeatureKey } from "@oodelscore/shared";
import { requireBusinessOwner, caseViewerForBusiness } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

// Which Attention Centre item kinds depend on an account-level feature flag
// — same flags each source's own page is already gated behind (Alert
// Rules/Playbooks/Decision Log/Improvement Initiatives). Case-related kinds
// have no such flag (Case Management is core, not a togglable feature), so
// they're always included.
const KIND_FEATURE: Partial<Record<AttentionItem["kind"], FeatureKey>> = {
  alert_fired: "alertRules",
  stalled_playbook: "playbooks",
  decision_ready_for_review: "decisionLog",
  initiative_not_started: "improvementInitiatives",
};

/**
 * A standalone business (or a single branch) always owns its Cases/Alerts
 * directly. Playbook Runs/Decision Log/Improvement Initiatives are
 * different: a BRANCH doesn't author its own — those live at the parent
 * org and are filtered down to entries affecting this branch (see each of
 * those routes' own isBranch comment) — so this mirrors that same
 * branch-aware filter rather than re-deriving it.
 */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "attentionCentre" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const product = await resolveViewProduct(session.business);
  const business = session.business;
  const isBranch = !!business.parentOrgId;

  const items = await computeAttentionCentre({
    caseViewer: caseViewerForBusiness(session),
    businessIds: [business._id],
    decisionLogFilter: isBranch
      ? { parentOrgId: business.parentOrgId, affectedBusinessIds: business._id }
      : { businessId: business._id },
    initiativeFilter: isBranch
      ? { parentOrgId: business.parentOrgId, affectedBusinessIds: business._id }
      : { businessId: business._id },
    playbookRunOwnerType: isBranch ? "parentOrg" : "business",
    playbookRunOwnerId: isBranch ? business.parentOrgId! : business._id,
    restrictPlaybookRunsToBusinessIds: isBranch ? [business._id] : null,
    product,
    portalPrefix: "/business",
    ownerDisplayName: business.name,
  });

  const enabledFeatures = business.enabledFeatures;
  const filtered = items.filter((item) => {
    const feature = KIND_FEATURE[item.kind];
    return !feature || hasFeature(enabledFeatures, feature);
  });

  return NextResponse.json({ status: "ok", product, items: filtered });
}
