import { NextResponse } from "next/server";
import { connectToDatabase, computeNetworkSummaries } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

export async function GET(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("q") ?? "").toLowerCase();
  const region = searchParams.get("region") ?? "";

  await connectToDatabase();
  const product = await resolveViewProduct(session.org);
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let summaries = await computeNetworkSummaries(session.org._id, from, now, product);

  if (search) summaries = summaries.filter((s) => s.name.toLowerCase().includes(search));
  if (region) summaries = summaries.filter((s) => s.region === region);

  summaries.sort((a, b) => (b.starAverage ?? -1) - (a.starAverage ?? -1));

  const regions = Array.from(new Set(summaries.map((s) => s.region).filter(Boolean)));

  return NextResponse.json({ status: "ok", branches: summaries, regions, total: summaries.length });
}
