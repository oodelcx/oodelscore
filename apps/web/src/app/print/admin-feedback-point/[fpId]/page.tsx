import { redirect, notFound } from "next/navigation";
import { connectToDatabase, FeedbackPoint, Business } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";
import { Poster } from "@/components/poster";

type RouteParams = { params: Promise<{ fpId: string }> };

export default async function AdminFeedbackPointPosterPage({ params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) redirect("/login");

  const { fpId } = await params;
  await connectToDatabase();
  const feedbackPoint = await FeedbackPoint.findById(fpId);
  if (!feedbackPoint) notFound();

  const business = await Business.findById(feedbackPoint.businessId);
  if (!business) notFound();

  return <Poster businessName={business.name} feedbackPointName={feedbackPoint.name} qrToken={feedbackPoint.qrToken} />;
}
