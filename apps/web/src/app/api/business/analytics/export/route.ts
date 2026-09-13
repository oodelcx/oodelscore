import { NextResponse } from "next/server";
import { connectToDatabase, Response, type IResponse } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import type { FilterQuery } from "mongoose";

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
  const feedbackPointId = searchParams.get("feedbackPointId");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  await connectToDatabase();
  const filter: FilterQuery<IResponse> = { businessId: session.business._id };
  if (feedbackPointId) filter.feedbackPointId = feedbackPointId;
  if (fromParam || toParam) {
    filter.submittedAt = {
      ...(fromParam ? { $gte: new Date(`${fromParam}T00:00:00.000Z`) } : {}),
      ...(toParam ? { $lte: new Date(`${toParam}T23:59:59.999Z`) } : {}),
    };
  }
  const responses = await Response.find(filter).sort({ submittedAt: -1 }).limit(5000);

  const rows = [["Submitted", "Question Type", "Value", "Age Group", "Gender", "Email"]];
  for (const response of responses) {
    for (const answer of response.answers) {
      rows.push([
        response.submittedAt.toISOString(),
        answer.type,
        String(answer.value ?? ""),
        response.demographics.ageGroup,
        response.demographics.gender,
        response.respondentEmail ?? "",
      ]);
    }
  }

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${session.business.name.replace(/[^a-z0-9]/gi, "_")}-feedback.csv"`,
    },
  });
}
