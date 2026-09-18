import { NextResponse } from "next/server";
import { connectToDatabase, TourScreen, SEED_TOURS, type ITourStepText } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ tourId: string }> };

const TOUR_IDS: readonly string[] = SEED_TOURS.map((t) => t.tourId);

function isValidStep(step: unknown): step is ITourStepText {
  return (
    !!step &&
    typeof step === "object" &&
    typeof (step as ITourStepText).key === "string" &&
    typeof (step as ITourStepText).title === "string" &&
    typeof (step as ITourStepText).body === "string"
  );
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.emailAndSiteContent.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { tourId } = await params;
  if (!TOUR_IDS.includes(tourId)) {
    return NextResponse.json({ status: "error", message: "Unknown tour" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.tourLabel !== "string" || !Array.isArray(body.steps) || !body.steps.every(isValidStep)) {
    return NextResponse.json({ status: "error", message: "Invalid body" }, { status: 400 });
  }

  // Only known step keys can be saved — the structural definition in code
  // owns which steps exist; this route just isn't the place to add or
  // remove one, unlike free-form title/body text.
  const seed = SEED_TOURS.find((t) => t.tourId === tourId)!;
  const knownKeys = new Set(seed.steps.map((s) => s.key));
  const steps = (body.steps as ITourStepText[]).filter((s) => knownKeys.has(s.key));

  await connectToDatabase();
  const doc = await TourScreen.findOneAndUpdate(
    { tourId },
    { $set: { tourLabel: body.tourLabel, steps } },
    { upsert: true, new: true }
  );

  return NextResponse.json({ status: "ok", tour: { tourId: doc.tourId, tourLabel: doc.tourLabel, steps: doc.steps } });
}
