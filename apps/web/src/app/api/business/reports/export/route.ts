import { NextResponse } from "next/server";
import {
  connectToDatabase,
  ActionBoardItem,
  ImprovementInitiative,
  computeBusinessMetrics,
  computeBusinessCategoryBreakdown,
} from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  await connectToDatabase();

  const [metrics, categoryBreakdown, casesResolved, initiativesCompleted, customersRespondedTo] = await Promise.all([
    computeBusinessMetrics(session.business._id, from, to),
    computeBusinessCategoryBreakdown(session.business._id, from, to),
    ActionBoardItem.countDocuments({ businessId: session.business._id, status: "resolved", resolvedAt: { $gte: from, $lte: to } }),
    ImprovementInitiative.countDocuments({
      $or: [{ businessId: session.business._id }, { affectedBusinessIds: session.business._id }],
      status: "completed",
      completedAt: { $gte: from, $lte: to },
    }),
    ActionBoardItem.countDocuments({ businessId: session.business._id, customerNotifiedAt: { $gte: from, $lte: to } }),
  ]);

  const rows: string[][] = [
    ["Report", session.business.name],
    ["Period", `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`],
    [],
    ["Metric", "Value"],
    ["Responses", String(metrics.responseCount)],
    ["Star average", metrics.starAverage !== null ? String(metrics.starAverage) : ""],
    ["NPS score", metrics.npsScore !== null ? String(metrics.npsScore) : ""],
    ["Cases resolved", String(casesResolved)],
    ["Customers personally responded to", String(customersRespondedTo)],
    ["Improvement initiatives completed", String(initiativesCompleted)],
    [],
    ["Category", "Average"],
    ...categoryBreakdown.map((c) => [c.name, String(c.average)]),
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${session.business.name.replace(/[^a-z0-9]/gi, "_")}-report.csv"`,
    },
  });
}
