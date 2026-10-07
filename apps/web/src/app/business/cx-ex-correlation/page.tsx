import { redirectUnlessProduct } from "@/lib/productPageGuard";
import BusinessCxExCorrelationClient from "./cx-ex-correlation-client";

export default async function BusinessCxExCorrelationPage() {
  await redirectUnlessProduct("business", "both");
  return <BusinessCxExCorrelationClient />;
}
