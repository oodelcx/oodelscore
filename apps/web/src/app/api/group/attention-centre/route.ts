import { NextResponse } from "next/server";
import { connectToDatabase, Business, computeAttentionCentre, hasFeature, type AttentionItem, type FeatureKey } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

// Mirrors /api/business/attention-centre's KIND_FEATURE gate.
const KIND_FEATURE: Partial<Record<AttentionItem["kind"], FeatureKey>> = {
  alert_fired: "alertRules",
  stalled_playbook: "playbooks",
  decision_ready_for_review: "decisionLog",
  initiative_not_started: "improvementInitiatives",
};

export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "attentionCentre" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const product = await resolveViewProduct(session.org);
  const org = session.org;

  const businesses = await Business.find({ parentOrgId: org._id }).select("_id");
  const businessIds = businesses.map((b) => b._id);

  const items = await computeAttentionCentre({
    businessIds,
    decisionLogFilter: { parentOrgId: org._id },
    initiativeFilter: { parentOrgId: org._id },
    playbookRunOwnerType: "parentOrg",
    playbookRunOwnerId: org._id,
    restrictPlaybookRunsToBusinessIds: null, // the org sees every stalled run at its own level, ad-hoc included
    product,
    portalPrefix: "/group",
    ownerDisplayName: org.name,
  });

  const enabledFeatures = org.enabledFeatures;
  const filtered = items.filter((item) => {
    const feature = KIND_FEATURE[item.kind];
    return !feature || hasFeature(enabledFeatures, feature);
  });

  return NextResponse.json({ status: "ok", product, items: filtered });
}
