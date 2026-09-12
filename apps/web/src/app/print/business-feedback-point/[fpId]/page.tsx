import { redirect, notFound } from "next/navigation";
import { connectToDatabase, FeedbackPoint } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { Poster } from "@/components/poster";

type RouteParams = { params: Promise<{ fpId: string }> };

export default async function BusinessFeedbackPointPosterPage({ params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) redirect("/login");

  const { fpId } = await params;
  await connectToDatabase();
  const feedbackPoint = await FeedbackPoint.findOne({ _id: fpId, businessId: session.business._id });
  if (!feedbackPoint) notFound();

  return <Poster businessName={session.business.name} feedbackPointName={feedbackPoint.name} qrToken={feedbackPoint.qrToken} />;
}
