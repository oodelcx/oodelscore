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
  if (typeof body?.toursEnabled !== "boolean") {
    return NextResponse.json({ status: "error", message: "toursEnabled must be a boolean" }, { status: 400 });
  }

  await connectToDatabase();
  const settings = await PlatformSettings.findOneAndUpdate(
    { singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY },
    { $set: { toursEnabled: body.toursEnabled } },
    { upsert: true, new: true }
  );

  return NextResponse.json({ status: "ok", settings });
}
