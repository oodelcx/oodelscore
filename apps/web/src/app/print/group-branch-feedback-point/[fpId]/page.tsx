import { redirect, notFound } from "next/navigation";
import { connectToDatabase, FeedbackPoint, Business } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { Poster } from "@/components/poster";

type RouteParams = { params: Promise<{ fpId: string }> };

// Mirrors /print/business-feedback-point, scoped to a Parent-Org owner
// retrieving one of their own branches' posters instead of a business
// retrieving its own — lets a Group owner reprint a lost poster or grab
// the scan link without asking the branch to look it up.
export default async function GroupBranchFeedbackPointPosterPage({ params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) redirect("/login");

  const { fpId } = await params;
  await connectToDatabase();
  const feedbackPoint = await FeedbackPoint.findById(fpId);
  if (!feedbackPoint) notFound();

  const business = await Business.findOne({ _id: feedbackPoint.businessId, parentOrgId: session.org._id });
  if (!business) notFound();

  return <Poster businessName={business.name} feedbackPointName={feedbackPoint.name} qrToken={feedbackPoint.qrToken} />;
}
