import { getTooltips } from "@/lib/tooltips";
import BusinessActionBoardClient from "./action-board-client";

export default async function BusinessActionBoardPage() {
  const tooltips = await getTooltips("action-board");
  return <BusinessActionBoardClient tooltips={tooltips} />;
}
