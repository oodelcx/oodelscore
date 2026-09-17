import { getTooltips } from "@/lib/tooltips";
import RawFeedbackClient from "./responses-client";

export default async function RawFeedbackPage() {
  const tooltips = await getTooltips("business-responses");
  return <RawFeedbackClient tooltips={tooltips} />;
}
