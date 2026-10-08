import { redirect } from "next/navigation";
import { redirectUnlessProduct } from "@/lib/productPageGuard";
import ClosingLoopClient from "@/components/closing-loop";

export default async function GroupClosingLoopPage() {
  // Staff roster / staff Closing the Loop are not part of launch.
  redirect("/group");
  // eslint-disable-next-line no-unreachable
  return <ClosingLoopClient apiPath="/api/group/closing-loop-updates" />;
}
