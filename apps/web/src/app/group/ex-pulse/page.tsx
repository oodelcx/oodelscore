import { redirectUnlessProduct } from "@/lib/productPageGuard";
import GroupExPulseClient from "./ex-pulse-client";

export default async function GroupExPulsePage() {
  await redirectUnlessProduct("group", "colleague");
  return <GroupExPulseClient />;
}
