import FeedbackPointsClient from "./feedback-points-client";
import { redirectUnlessPage } from "@/lib/productPageGuard";

export default async function FeedbackPointsPage() {
  await redirectUnlessPage("business", "feedbackPoints", "feedbackPoints");
  return <FeedbackPointsClient />;
}
