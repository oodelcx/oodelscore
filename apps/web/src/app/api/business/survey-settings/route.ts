import { NextResponse } from "next/server";
import { connectToDatabase, QuestionTemplate } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const template = session.business.questionTemplateId ? await QuestionTemplate.findById(session.business.questionTemplateId) : null;

  const typesInUse = new Set(template?.questions.map((q) => q.type) ?? []);

  return NextResponse.json({
    status: "ok",
    demographicConfig: session.business.demographicConfig,
    typesInUse: Array.from(typesInUse),
  });
}
