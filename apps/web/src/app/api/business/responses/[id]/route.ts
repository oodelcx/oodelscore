import { NextResponse } from "next/server";
import { connectToDatabase, Response } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ requirePage: "rawFeedback" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const response = await Response.findOne({ _id: id, businessId: session.business._id });
  if (!response) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.flagged === "boolean") response.flagged = body.flagged;
  await response.save();

  return NextResponse.json({ status: "ok", response });
}
