import { NextResponse } from "next/server";
import { connectToDatabase, getCxPulseFrameworkOrDefault, CxPulseFramework, CX_PULSE_FRAMEWORK_SINGLETON_KEY } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const framework = await getCxPulseFrameworkOrDefault();
  return NextResponse.json({ status: "ok", framework });
}

export async function PATCH(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.isSystemRole || session.role.name !== "Admin") {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const weights = body?.weights;
  if (
    !weights ||
    typeof weights.awareness !== "number" ||
    typeof weights.response !== "number" ||
    typeof weights.ownership !== "number" ||
    typeof weights.culture !== "number" ||
    typeof weights.outcome !== "number"
  ) {
    return NextResponse.json({ status: "error", message: "weights must include all 5 dimensions" }, { status: 400 });
  }
  const total = weights.awareness + weights.response + weights.ownership + weights.culture + weights.outcome;
  if (Math.round(total) !== 100) {
    return NextResponse.json({ status: "error", message: `Weights must sum to 100 (got ${total})` }, { status: 400 });
  }

  const levelDescriptions = Array.isArray(body?.levelDescriptions)
    ? body.levelDescriptions.slice(0, 5).map((d: unknown) => (typeof d === "string" ? d : ""))
    : undefined;
  if (levelDescriptions && levelDescriptions.length !== 5) {
    return NextResponse.json({ status: "error", message: "levelDescriptions must have exactly 5 entries" }, { status: 400 });
  }

  await connectToDatabase();
  const framework = await CxPulseFramework.findOneAndUpdate(
    { singletonKey: CX_PULSE_FRAMEWORK_SINGLETON_KEY },
    {
      $set: {
        weights,
        pulseQuestions: Array.isArray(body?.pulseQuestions) ? body.pulseQuestions.filter((q: unknown) => typeof q === "string") : [],
        ...(levelDescriptions ? { levelDescriptions } : {}),
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ status: "ok", framework });
}
