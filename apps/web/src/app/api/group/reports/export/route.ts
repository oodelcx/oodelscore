import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  ActionBoardItem,
  ImprovementInitiative,
  computeNetworkSummaries,
  hasProduct,
} from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

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
  const product = await resolveViewProduct(session.org);

  const [summaries, casesResolved, initiativesCompleted, customersRespondedTo] = await Promise.all([
    computeNetworkSummaries(session.org._id, from, to, product),
    ActionBoardItem.countDocuments({
      parentOrgId: session.org._id,
      product,
      status: "resolved",
      resolvedAt: { $gte: from, $lte: to },
    }),
    ImprovementInitiative.countDocuments({ parentOrgId: session.org._id, product, status: "completed", completedAt: { $gte: from, $lte: to } }),
    ActionBoardItem.countDocuments({ parentOrgId: session.org._id, product, customerNotifiedAt: { $gte: from, $lte: to } }),
  ]);

  const rows: string[][] = [
    ["Report", session.org.name],
    ["Product", product === "colleague_experience" ? "Colleague Experience" : "Customer Experience"],
    ["Period", `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`],
    [],
    ["Metric", "Value"],
    ["Cases resolved", String(casesResolved)],
    ["Customers personally responded to", String(customersRespondedTo)],
    ["Improvement initiatives completed", String(initiativesCompleted)],
    [],
    ["Branch", "Region", "Responses", "Star average", product === "colleague_experience" ? "eNPS" : "NPS"],
    ...summaries.map((s) => [s.name, s.region, String(s.responseCount), s.starAverage !== null ? String(s.starAverage) : "", s.npsScore !== null ? String(s.npsScore) : ""]),
  ];

  if (product === "customer_experience" && hasProduct(session.org, "colleague_experience")) {
    const [ceSummaries, ceCasesResolved] = await Promise.all([
      computeNetworkSummaries(session.org._id, from, to, "colleague_experience"),
      ActionBoardItem.countDocuments({
        parentOrgId: session.org._id,
        product: "colleague_experience",
        status: "resolved",
        resolvedAt: { $gte: from, $lte: to },
      }),
    ]);
    rows.push(
      [],
      ["Colleague Experience — Metric", "Value"],
      ["Cases resolved", String(ceCasesResolved)],
      [],
      ["Colleague Experience — Branch", "Region", "Responses", "Star average", "eNPS"],
      ...ceSummaries.map((s) => [
        s.name,
        s.region,
        String(s.responseCount),
        s.starAverage !== null ? String(s.starAverage) : "",
        s.npsScore !== null ? String(s.npsScore) : "",
      ])
    );
  }

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${session.org.name.replace(/[^a-z0-9]/gi, "_")}-report.csv"`,
    },
  });
}
