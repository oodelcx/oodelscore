import { getTooltips } from "@/lib/tooltips";
import { getCurrentUser } from "@/lib/session";
import { connectToDatabase, Business } from "@oodelscore/shared";
import BranchCxPulseClient from "./cx-pulse-client";
import StandaloneCxPulseClient from "./standalone-cx-pulse-client";

export default async function BusinessCxPulsePage() {
  const tooltips = await getTooltips("business-cx-pulse");
  const user = await getCurrentUser();
  await connectToDatabase();
  const business = user ? await Business.findById(user.parentId).select("parentOrgId") : null;
  const isBranch = !!business?.parentOrgId;
  return isBranch ? <BranchCxPulseClient tooltips={tooltips} /> : <StandaloneCxPulseClient tooltips={tooltips} />;
}
