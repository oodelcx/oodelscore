import { redirectUnlessProduct } from "@/lib/productPageGuard";
import BusinessExPulseClient from "./ex-pulse-client";

export default async function BusinessExPulsePage() {
  await redirectUnlessProduct("business", "colleague");
  return <BusinessExPulseClient />;
}
