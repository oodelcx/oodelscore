import { redirect } from "next/navigation";
import { redirectUnlessProduct } from "@/lib/productPageGuard";
import BusinessRosterClient from "./roster-client";

export default async function BusinessRosterPage() {
  // Staff roster / staff Closing the Loop are not part of launch.
  redirect("/business");
  // eslint-disable-next-line no-unreachable
  return <BusinessRosterClient />;
}
