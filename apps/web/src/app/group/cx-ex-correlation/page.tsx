import { redirectUnlessProduct } from "@/lib/productPageGuard";
import GroupCxExCorrelationClient from "./cx-ex-correlation-client";

export default async function GroupCxExCorrelationPage() {
  await redirectUnlessProduct("group", "both");
  return <GroupCxExCorrelationClient />;
}
