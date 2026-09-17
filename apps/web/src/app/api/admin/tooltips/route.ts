import { NextResponse } from "next/server";
import { connectToDatabase, TooltipScreen, SEED_TOOLTIPS } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.emailAndSiteContent.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const docs = await TooltipScreen.find({ screenKey: { $in: SEED_TOOLTIPS.map((s) => s.screenKey) } });
  const byScreen = new Map(docs.map((d) => [d.screenKey, d]));

  return NextResponse.json({
    status: "ok",
    // Falls back to the seed per-screen if no DB doc exists yet, same
    // resilience pattern as the Site Content admin API — this screen shows
    // what's actually live instead of blank rows that would silently wipe
    // real copy if saved as-is.
    screens: SEED_TOOLTIPS.map((seed) => {
      const doc = byScreen.get(seed.screenKey);
      return {
        screenKey: seed.screenKey,
        screenLabel: doc?.screenLabel ?? seed.screenLabel,
        tooltips: doc?.tooltips ?? seed.tooltips,
      };
    }),
  });
}
