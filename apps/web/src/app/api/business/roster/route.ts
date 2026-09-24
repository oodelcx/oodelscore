import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, RosterEntry, hasProduct, getTeamMemberProducts, logApiRouteError } from "@oodelscore/shared";
import { requireBusinessOwner, type BusinessOwnerSession } from "@/lib/ownerAuth";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BULK_ENTRIES = 1000;

/**
 * Colleague Experience's employee roster management for a Business. Per
 * RosterEntry's own comment, this is deliberately write-only from the
 * account's point of view — GET here returns aggregate counts only
 * (how many active, how many newly due for a lifecycle survey), never the
 * underlying email list. There is no "browse roster" screen by design.
 */
function canUseColleagueExperience(session: BusinessOwnerSession): boolean {
  if (!hasProduct(session.business, "colleague_experience")) return false;
  if (session.isTeamMember) return getTeamMemberProducts(session.user).includes("colleague_experience");
  return true;
}

export async function GET() {
  try {
    const session = await requireBusinessOwner({ requirePage: "colleagueRoster" });
    if (!session || !canUseColleagueExperience(session)) {
      return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    }

    await connectToDatabase();
    const businessId = session.business._id;
    const now = new Date();
    const threshold30 = new Date(now.getTime() - 30 * DAY_MS);
    const threshold90 = new Date(now.getTime() - 90 * DAY_MS);

    const [totalEnrolled, totalActive, dueOnboarding30, dueOnboarding90, dueExit] = await Promise.all([
      RosterEntry.countDocuments({ businessId }),
      RosterEntry.countDocuments({ businessId, endDate: null }),
      RosterEntry.countDocuments({
        businessId,
        startDate: { $ne: null, $lte: threshold30 },
        endDate: null,
        triggeredStages: { $ne: "onboarding_30" },
      }),
      RosterEntry.countDocuments({
        businessId,
        startDate: { $ne: null, $lte: threshold90 },
        endDate: null,
        triggeredStages: { $ne: "onboarding_90" },
      }),
      RosterEntry.countDocuments({ businessId, endDate: { $ne: null, $lte: now }, triggeredStages: { $ne: "exit" } }),
    ]);

    return NextResponse.json({
      status: "ok",
      stats: { totalEnrolled, totalActive, dueOnboarding30, dueOnboarding90, dueExit },
    });
  } catch (err) {
    await logApiRouteError("business/roster GET", err);
    return NextResponse.json({ status: "error", message: "Something went wrong" }, { status: 500 });
  }
}

interface IncomingEntry {
  email: string;
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * Bulk add/update. Upsert on (businessId, email) — re-uploading the same
 * list is idempotent, and never touches triggeredStages on an existing
 * entry so an update never re-fires a survey that already went out.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireBusinessOwner({ requirePage: "colleagueRoster" });
    if (!session || !canUseColleagueExperience(session)) {
      return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const rawEntries: IncomingEntry[] = Array.isArray(body?.entries) ? body.entries : [];
    if (rawEntries.length === 0) {
      return NextResponse.json({ status: "error", message: "No entries provided" }, { status: 400 });
    }
    if (rawEntries.length > MAX_BULK_ENTRIES) {
      return NextResponse.json({ status: "error", message: `At most ${MAX_BULK_ENTRIES} entries per upload` }, { status: 400 });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const operations = [];
    let skipped = 0;
    for (const raw of rawEntries) {
      const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
      if (!email || !emailPattern.test(email)) {
        skipped++;
        continue;
      }
      const startDate = raw.startDate ? new Date(raw.startDate) : null;
      const endDate = raw.endDate ? new Date(raw.endDate) : null;
      operations.push({
        updateOne: {
          filter: { businessId: session.business._id, email },
          update: {
            $set: {
              startDate: startDate && !isNaN(startDate.getTime()) ? startDate : null,
              endDate: endDate && !isNaN(endDate.getTime()) ? endDate : null,
            },
            $setOnInsert: { triggeredStages: [] },
          },
          upsert: true,
        },
      });
    }

    if (operations.length === 0) {
      return NextResponse.json({ status: "error", message: "No valid entries provided" }, { status: 400 });
    }

    await connectToDatabase();
    const result = await RosterEntry.bulkWrite(operations);

    return NextResponse.json({
      status: "ok",
      upserted: result.upsertedCount,
      updated: result.modifiedCount,
      skipped,
    });
  } catch (err) {
    await logApiRouteError("business/roster POST", err);
    return NextResponse.json({ status: "error", message: "Something went wrong" }, { status: 500 });
  }
}

/** Mark one roster entry exited — sets endDate, which the daily cron then picks up for the exit survey. */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireBusinessOwner({ requirePage: "colleagueRoster" });
    if (!session || !canUseColleagueExperience(session)) {
      return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json({ status: "error", message: "Email is required" }, { status: 400 });
    }
    const endDate = body?.endDate ? new Date(body.endDate) : new Date();
    if (isNaN(endDate.getTime())) {
      return NextResponse.json({ status: "error", message: "Invalid end date" }, { status: 400 });
    }

    await connectToDatabase();
    const updated = await RosterEntry.findOneAndUpdate(
      { businessId: session.business._id, email },
      { $set: { endDate } }
    );
    if (!updated) {
      return NextResponse.json({ status: "error", message: "No roster entry found for that email" }, { status: 404 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    await logApiRouteError("business/roster PATCH", err);
    return NextResponse.json({ status: "error", message: "Something went wrong" }, { status: 500 });
  }
}

/** Remove a roster entry entirely — for correcting a mistaken upload, not for offboarding (use PATCH for that). */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireBusinessOwner({ requirePage: "colleagueRoster" });
    if (!session || !canUseColleagueExperience(session)) {
      return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    }

    const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ status: "error", message: "Email is required" }, { status: 400 });
    }

    await connectToDatabase();
    const result = await RosterEntry.deleteOne({ businessId: session.business._id, email });
    if (result.deletedCount === 0) {
      return NextResponse.json({ status: "error", message: "No roster entry found for that email" }, { status: 404 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    await logApiRouteError("business/roster DELETE", err);
    return NextResponse.json({ status: "error", message: "Something went wrong" }, { status: 500 });
  }
}
