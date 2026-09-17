import { getTooltips } from "@/lib/tooltips";
import FeedbackPointsClient from "./feedback-points-client";

export default async function FeedbackPointsPage() {
  const tooltips = await getTooltips("feedback-points");
  return <FeedbackPointsClient tooltips={tooltips} />;
}
