import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Industry,
  IndustryContentPack,
  DEFAULT_INDUSTRY_CONTENT,
  PlatformSettings,
  PLATFORM_SETTINGS_SINGLETON_KEY,
} from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Admin content editor for OodelCX Compass (OBS12): the industry-specific
 * wording overlay (IndustryContentPack) plus the global reassessment
 * cadence setting, both previously admin-editable in schema/intent only —
 * no UI existed for either. Gated on `questionTemplates`, the same
 * permission the Industries admin page uses, since this is the same kind
 * of "survey/assessment content configuration" the spec reserves for that key.
 */
export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const [industries, packs, settings] = await Promise.all([
    Industry.find().sort({ name: 1 }),
    IndustryContentPack.find(),
    PlatformSettings.findOneAndUpdate(
      { singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY },
      { $setOnInsert: { singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY } },
      { upsert: true, new: true }
    ),
  ]);
  const packByIndustry = new Map(packs.map((p) => [p.industry, p]));

  const items = industries.map((i) => {
    const pack = packByIndustry.get(i.name);
    return {
      industry: i.name,
      numbersOutcomeExamples: pack?.numbersOutcomeExamples ?? DEFAULT_INDUSTRY_CONTENT.numbersOutcomeExamples,
      hearingChannelExamples: pack?.hearingChannelExamples ?? DEFAULT_INDUSTRY_CONTENT.hearingChannelExamples,
      ownershipRoleExamples: pack?.ownershipRoleExamples ?? DEFAULT_INDUSTRY_CONTENT.ownershipRoleExamples,
      rhythmTriggerExample: pack?.rhythmTriggerExample ?? DEFAULT_INDUSTRY_CONTENT.rhythmTriggerExample,
      hasCustomPack: !!pack,
    };
  });

  return NextResponse.json({
    status: "ok",
    industries: items,
    compassReassessmentCadenceDays: settings.compassReassessmentCadenceDays,
  });
}

export async function PUT(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const industry = typeof body?.industry === "string" ? body.industry.trim() : "";
  if (!industry) {
    return NextResponse.json({ status: "error", message: "industry is required" }, { status: 400 });
  }

  const fields = ["numbersOutcomeExamples", "hearingChannelExamples", "ownershipRoleExamples", "rhythmTriggerExample"] as const;
  const update: Record<string, string> = {};
  for (const field of fields) {
    if (typeof body[field] === "string") update[field] = body[field];
  }

  await connectToDatabase();
  const pack = await IndustryContentPack.findOneAndUpdate({ industry }, { $set: update }, { upsert: true, new: true });

  return NextResponse.json({ status: "ok", pack });
}
