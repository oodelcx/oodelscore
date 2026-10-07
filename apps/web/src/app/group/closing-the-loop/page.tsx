import { redirectUnlessProduct } from "@/lib/productPageGuard";
import ClosingLoopClient from "@/components/closing-loop";

export default async function GroupClosingLoopPage() {
  await redirectUnlessProduct("group", "colleague");
  return <ClosingLoopClient apiPath="/api/group/closing-loop-updates" />;
}
