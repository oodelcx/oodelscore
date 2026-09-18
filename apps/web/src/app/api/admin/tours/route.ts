import { NextResponse } from "next/server";
import { connectToDatabase, TourScreen, SEED_TOURS } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.emailAndSiteContent.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const docs = await TourScreen.find({ tourId: { $in: SEED_TOURS.map((t) => t.tourId) } });
  const byTourId = new Map(docs.map((d) => [d.tourId, d]));

  return NextResponse.json({
    status: "ok",
    // Falls back to the seed per-tour if no DB doc exists yet — same
    // resilience pattern as the Tooltips/Site Content admin APIs, so this
    // screen shows what's actually live rather than blank rows that would
    // silently wipe real copy if saved as-is.
    tours: SEED_TOURS.map((seed) => {
      const doc = byTourId.get(seed.tourId);
      return {
        tourId: seed.tourId,
        tourLabel: doc?.tourLabel ?? seed.tourLabel,
        steps: seed.steps.map((seedStep) => {
          const saved = doc?.steps.find((s) => s.key === seedStep.key);
          return { key: seedStep.key, title: saved?.title ?? seedStep.title, body: saved?.body ?? seedStep.body };
        }),
      };
    }),
  });
}
