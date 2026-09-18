import { NextResponse } from "next/server";
import { connectToDatabase, User } from "@oodelscore/shared";
import { getCurrentUser } from "@/lib/session";

// Marks a guided-tour id as seen (completed or explicitly skipped) on the
// current user's account. Any logged-in Business/Parent Org account can
// call this — admin_staff never sees the tour UI in the first place (see
// TourProvider's mount points: business/layout.tsx and group/layout.tsx
// only), so there's no need to gate accountType here too.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const tourId = typeof body?.tourId === "string" ? body.tourId.trim() : "";
  if (!tourId) return NextResponse.json({ status: "error", message: "tourId is required" }, { status: 400 });

  await connectToDatabase();
  await User.updateOne({ _id: user._id }, { $addToSet: { seenTours: tourId } });

  return NextResponse.json({ status: "ok" });
}
