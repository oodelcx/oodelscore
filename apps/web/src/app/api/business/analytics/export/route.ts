import { NextResponse } from "next/server";
import { connectToDatabase, Response } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const responses = await Response.find({ businessId: session.business._id }).sort({ submittedAt: -1 }).limit(5000);

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
