import { NextResponse } from "next/server";
import { connectToDatabase, Business, ActionBoardItem, ImprovementInitiative, computeNetworkSummaries } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  await connectToDatabase();

  const [summaries, casesResolved, initiativesCompleted, customersRespondedTo] = await Promise.all([
    computeNetworkSummaries(session.org._id, from, to),
    ActionBoardItem.countDocuments({ parentOrgId: session.org._id, status: "resolved", resolvedAt: { $gte: from, $lte: to } }),
    ImprovementInitiative.countDocuments({ parentOrgId: session.org._id, status: "completed", completedAt: { $gte: from, $lte: to } }),
    ActionBoardItem.countDocuments({ parentOrgId: session.org._id, customerNotifiedAt: { $gte: from, $lte: to } }),
  ]);

  const rows: string[][] = [
    ["Report", session.org.name],
    ["Period", `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`],
    [],
    ["Metric", "Value"],
    ["Cases resolved", String(casesResolved)],
    ["Customers personally responded to", String(customersRespondedTo)],
    ["Improvement initiatives completed", String(initiativesCompleted)],
    [],
    ["Branch", "Region", "Responses", "Star average", "NPS"],
    ...summaries.map((s) => [s.name, s.region, String(s.responseCount), s.starAverage !== null ? String(s.starAverage) : "", s.npsScore !== null ? String(s.npsScore) : ""]),
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${session.org.name.replace(/[^a-z0-9]/gi, "_")}-report.csv"`,
    },
  });
}
