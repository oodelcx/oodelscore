import { NextResponse } from "next/server";
import { connectToDatabase, PlatformSettings, PLATFORM_SETTINGS_SINGLETON_KEY } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const settings = await PlatformSettings.findOneAndUpdate(
    { singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY },
    { $setOnInsert: { singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY } },
    { upsert: true, new: true }
  );
  return NextResponse.json({ status: "ok", settings });
}

export async function PATCH(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.isSystemRole || session.role.name !== "Admin") {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const update: Record<string, boolean> = {};
  if (body?.toursEnabled !== undefined) {
    if (typeof body.toursEnabled !== "boolean") {
      return NextResponse.json({ status: "error", message: "toursEnabled must be a boolean" }, { status: 400 });
    }
    update.toursEnabled = body.toursEnabled;
  }
  if (body?.paymentGateEnabled !== undefined) {
    if (typeof body.paymentGateEnabled !== "boolean") {
      return NextResponse.json({ status: "error", message: "paymentGateEnabled must be a boolean" }, { status: 400 });
    }
    update.paymentGateEnabled = body.paymentGateEnabled;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ status: "error", message: "Nothing to update" }, { status: 400 });
  }

  await connectToDatabase();
  const settings = await PlatformSettings.findOneAndUpdate(
    { singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY },
    { $set: update },
    { upsert: true, new: true }
  );

  return NextResponse.json({ status: "ok", settings });
}
