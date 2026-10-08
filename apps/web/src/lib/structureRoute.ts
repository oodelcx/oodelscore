import { NextResponse } from "next/server";
import { connectToDatabase, loadStructure, applyStructureAction, previewChain, StructureError, type StructureOwner } from "@oodelscore/shared";

/** Shared body of every structure route (group, standalone business, Admin for either). Callers check who may do what first. */
export async function structureGet(owner: StructureOwner) {
  await connectToDatabase();
  try {
    return NextResponse.json({ status: "ok", ...(await loadStructure(owner)) });
  } catch (err) {
    if (err instanceof StructureError) return NextResponse.json({ status: "error", message: err.message }, { status: 400 });
    throw err;
  }
}

export async function structurePost(owner: StructureOwner, request: Request) {
  await connectToDatabase();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ status: "error", message: "Invalid request" }, { status: 400 });
  try {
    if (body.action === "preview") {
      return NextResponse.json({ status: "ok", preview: await previewChain(owner, String(body.businessId ?? "")) });
    }
    await applyStructureAction(owner, body);
    return NextResponse.json({ status: "ok", ...(await loadStructure(owner)) });
  } catch (err) {
    if (err instanceof StructureError) return NextResponse.json({ status: "error", message: err.message }, { status: 400 });
    throw err;
  }
}
