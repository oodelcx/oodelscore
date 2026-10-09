import { NextResponse } from "next/server";
import {
  connectToDatabase,
  loadStructure,
  applyStructureAction,
  previewChain,
  previewImport,
  applyImport,
  StructureError,
  type StructureOwner,
  type StructureActor,
  type ImportKind,
  type ImportRow,
} from "@oodelscore/shared";

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

export async function structurePost(owner: StructureOwner, request: Request, actor: StructureActor) {
  await connectToDatabase();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ status: "error", message: "Invalid request" }, { status: 400 });
  try {
    if (body.action === "preview") {
      return NextResponse.json({ status: "ok", preview: await previewChain(owner, String(body.businessId ?? "")) });
    }
    if (body.action === "importPreview" || body.action === "importApply") {
      const kind: ImportKind = body.kind === "branches" ? "branches" : "people";
      const rows = Array.isArray(body.rows) ? (body.rows as ImportRow[]) : [];
      if (body.action === "importPreview") {
        return NextResponse.json({ status: "ok", import: await previewImport(owner, actor, kind, rows) });
      }
      const result = await applyImport(owner, actor, kind, rows);
      return NextResponse.json({ status: "ok", message: result.message, ...(await loadStructure(owner)) });
    }
    const result = await applyStructureAction(owner, body, actor);
    return NextResponse.json({ status: "ok", message: result.message, ...(await loadStructure(owner)) });
  } catch (err) {
    if (err instanceof StructureError) return NextResponse.json({ status: "error", message: err.message }, { status: 400 });
    throw err;
  }
}
