import { NextResponse } from "next/server";
import { connectToDatabase } from "@oodelscore/shared";

/**
 * Milestone 1 health check: confirms the app can reach MongoDB Atlas using
 * MONGODB_URI. No auth, no business logic — just proves the scaffold boots
 * end-to-end.
 */
export async function GET() {
  try {
    await connectToDatabase();
    return NextResponse.json({ status: "ok", mongo: "connected" });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
