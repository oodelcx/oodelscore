import { NextResponse } from "next/server";
import { connectToDatabase, EmailTemplate, EMAIL_TEMPLATE_KEYS } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ key: string }> };

const KEY_SET: readonly string[] = EMAIL_TEMPLATE_KEYS;

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.emailAndSiteContent.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { key } = await params;
  if (!KEY_SET.includes(key)) {
    return NextResponse.json({ status: "error", message: "Unknown template" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.subject !== "string" || !body.subject.trim()) {
    return NextResponse.json({ status: "error", message: "subject is required" }, { status: 400 });
  }
  if (typeof body?.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ status: "error", message: "body is required" }, { status: 400 });
  }

  await connectToDatabase();
  const template = await EmailTemplate.findOneAndUpdate(
    { key },
    { $set: { subject: body.subject, body: body.body, lastEditedAt: new Date() } },
    { new: true }
  );
  if (!template) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok", template });
}
