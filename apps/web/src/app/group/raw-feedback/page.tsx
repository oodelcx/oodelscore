import { getTooltips } from "@/lib/tooltips";
import GroupRawFeedbackClient from "./raw-feedback-client";

export default async function GroupRawFeedbackPage() {
  const tooltips = await getTooltips("group-raw-feedback");
  return <GroupRawFeedbackClient tooltips={tooltips} />;
}
