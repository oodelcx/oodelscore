import { redirectUnlessProduct } from "@/lib/productPageGuard";
import BusinessRosterClient from "./roster-client";

export default async function BusinessRosterPage() {
  await redirectUnlessProduct("business", "colleague");
  return <BusinessRosterClient />;
}
