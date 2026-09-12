import { NextResponse } from "next/server";
import { connectToDatabase, FeedbackPoint, generateQrPngBuffer } from "@oodelscore/shared";

type RouteParams = { params: Promise<{ qrToken: string }> };

/**
 * Public: renders the QR PNG for a Feedback Point's public feedback link.
 * Deliberately takes only a qrToken (never an arbitrary caller-supplied
 * URL) so this can't be used as a general-purpose QR generator — it always
 * encodes the same /feedback/[qrToken] URL a scanner would already reach.
 * No more sensitive than that public feedback page itself.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { qrToken } = await params;

  await connectToDatabase();
  const feedbackPoint = await FeedbackPoint.findOne({ qrToken });
  if (!feedbackPoint) {
    return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  }

  const appUrl = process.env.APP_URL ?? "";
  const publicUrl = `${appUrl}/feedback/${qrToken}`;
  const png = await generateQrPngBuffer(publicUrl);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
