import { NextResponse } from "next/server";
import { connectToDatabase, submitCompassAnswer, hasFeature, ANCHOR_DIMENSIONS, getCompassQuestionBank } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function POST(request: Request) {
  const session = await requireParentOrgOwner({ requirePage: "compass" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "compass")) {
    return NextResponse.json({ status: "error", message: "OodelCX Compass is not enabled for this account" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const questionKey = typeof body?.questionKey === "string" ? body.questionKey : null;
  const value = body?.value;

  await connectToDatabase();
  const bank = await getCompassQuestionBank();
  const questionDef = questionKey ? bank.find((q) => q.key === questionKey) : undefined;
  if (!questionDef) return NextResponse.json({ status: "error", message: "Unknown question" }, { status: 400 });
  if (typeof value !== "number" || ![0, 1, 2, 3].includes(value)) {
    return NextResponse.json({ status: "error", message: "value must be 0, 1, 2, or 3" }, { status: 400 });
  }
  if (!(ANCHOR_DIMENSIONS as readonly string[]).includes(questionDef.dimension)) {
    return NextResponse.json({ status: "error", message: "Invalid dimension" }, { status: 400 });
  }

  await submitCompassAnswer(
    "parentOrg",
    session.org._id,
    session.org.industry,
    questionKey!,
    questionDef.dimension,
    value as 0 | 1 | 2 | 3,
    questionDef.text
  );

  return NextResponse.json({ status: "ok" });
}
