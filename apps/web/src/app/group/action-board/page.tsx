import { getTooltips } from "@/lib/tooltips";
import ActionBoardClient from "./action-board-client";

export default async function GroupActionBoardPage() {
  const tooltips = await getTooltips("group-action-board");
  return <ActionBoardClient tooltips={tooltips} />;
}
