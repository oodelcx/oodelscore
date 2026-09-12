import { NextResponse } from "next/server";
import { connectToDatabase, EmailTemplate, EMAIL_TEMPLATE_KEYS } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.emailAndSiteContent.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const templates = await EmailTemplate.find({ key: { $in: EMAIL_TEMPLATE_KEYS } });

  return NextResponse.json({ status: "ok", templates });
}
