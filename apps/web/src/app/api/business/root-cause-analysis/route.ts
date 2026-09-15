import { NextResponse } from "next/server";
import { connectToDatabase, gatherRootCauseEvidence, analyzeRootCause } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * "Why is this happening?" — gathers real evidence for one category, then
 * asks Claude to explain only that evidence (see ai/rootCause.ts for the
 * evidence-only rule). Triggered on demand from the Driver Analysis card,
 * not scheduled — this is a low-volume, high-stakes call, unlike the
 * Haiku-driven periodic pipelines.
 */
export async function POST(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  if (!categoryId) return NextResponse.json({ status: "error", message: "categoryId is required" }, { status: 400 });

  await connectToDatabase();
  const evidence = await gatherRootCauseEvidence([session.business._id], categoryId);
  const analysis = await analyzeRootCause(evidence);

  return NextResponse.json({ status: "ok", evidence, analysis });
}
