import { redirectUnlessProduct } from "@/lib/productPageGuard";
import ClosingLoopClient from "@/components/closing-loop";

export default async function BusinessClosingLoopPage() {
  await redirectUnlessProduct("business", "colleague");
  return <ClosingLoopClient apiPath="/api/business/closing-loop-updates" />;
}
