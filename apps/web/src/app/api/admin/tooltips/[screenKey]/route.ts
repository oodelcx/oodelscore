import { NextResponse } from "next/server";
import { connectToDatabase, TooltipScreen, SEED_TOOLTIPS, type ITooltipEntry } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ screenKey: string }> };

const SCREEN_KEYS: readonly string[] = SEED_TOOLTIPS.map((s) => s.screenKey);

function isValidEntry(entry: unknown): entry is ITooltipEntry {
  return (
    !!entry &&
    typeof entry === "object" &&
    typeof (entry as ITooltipEntry).key === "string" &&
    typeof (entry as ITooltipEntry).label === "string" &&
    typeof (entry as ITooltipEntry).text === "string"
  );
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.emailAndSiteContent.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { screenKey } = await params;
  if (!SCREEN_KEYS.includes(screenKey)) {
    return NextResponse.json({ status: "error", message: "Unknown screen" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !Array.isArray(body.tooltips) || !body.tooltips.every(isValidEntry)) {
    return NextResponse.json({ status: "error", message: "Invalid body" }, { status: 400 });
  }

  const seed = SEED_TOOLTIPS.find((s) => s.screenKey === screenKey)!;

  await connectToDatabase();
  const doc = await TooltipScreen.findOneAndUpdate(
    { screenKey },
    { $set: { screenLabel: seed.screenLabel, tooltips: body.tooltips as ITooltipEntry[] } },
    { upsert: true, new: true }
  );

  // Site Content edits through this same admin area aren't audited either
  // (only its "reset to defaults" action is) — matching that convention
  // rather than inventing new audit coverage here.

  return NextResponse.json({
    status: "ok",
    screen: { screenKey: doc.screenKey, screenLabel: doc.screenLabel, tooltips: doc.tooltips },
  });
}
