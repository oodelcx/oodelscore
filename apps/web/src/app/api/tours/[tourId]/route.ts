import { NextResponse } from "next/server";
import { connectToDatabase, TourScreen, SEED_TOURS } from "@oodelscore/shared";

type RouteParams = { params: Promise<{ tourId: string }> };

/**
 * Client-fetchable tour copy — no auth check, same reasoning as
 * /api/tooltips/[screen]: this is non-sensitive UI text, and every account
 * type this feature is shown to (everyone except admin_staff) is already
 * past login by the time TourProvider calls this.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { tourId } = await params;
  const seed = SEED_TOURS.find((t) => t.tourId === tourId);
  if (!seed) return NextResponse.json({ status: "error", message: "Unknown tour" }, { status: 404 });

  try {
    await connectToDatabase();
    const doc = await TourScreen.findOne({ tourId });
    return NextResponse.json({
      status: "ok",
      tour: { tourId, tourLabel: doc?.tourLabel ?? seed.tourLabel, steps: doc?.steps ?? seed.steps },
    });
  } catch {
    // A tour never blocks the page it's shown on — fall back to seed copy.
    return NextResponse.json({ status: "ok", tour: seed });
  }
}
