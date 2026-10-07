import GroupFeedbackPointsClient from "./feedback-points-client";
import { redirectUnlessPage } from "@/lib/productPageGuard";

export default async function GroupFeedbackPointsPage() {
  await redirectUnlessPage("group", "feedbackPoints");
  return <GroupFeedbackPointsClient />;
}
