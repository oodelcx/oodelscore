import { BillingSubscription, type BillingOwnerType } from "../models/BillingSubscription";

export type BillingAccessStatus = "active" | "never_activated" | "lapsed";

/**
 * The payment gate, with the *reason* access is denied — an owner with no
 * BillingSubscription row at all has never gone through billing setup
 * ("never_activated": a brand-new account Admin just created), which reads
 * very differently to a customer than one whose comp period or Stripe
 * subscription used to be live and has since ended ("lapsed"). Business/
 * Group layouts use this to decide whether to render the portal or the
 * locked screen, and which locked-screen copy to show; the Billing page
 * itself is always let through regardless (see middleware.ts + the
 * layouts' x-pathname check) so there's always a way to pay.
 */
export async function getBillingAccessStatus(ownerType: BillingOwnerType, ownerId: string): Promise<BillingAccessStatus> {
  const subscription = await BillingSubscription.findOne({ ownerType, ownerId });
  if (!subscription) return "never_activated";

  if (subscription.isComp) {
    if (!subscription.compExpiresAt) return "active"; // unlimited comp
    return subscription.compExpiresAt.getTime() > Date.now() ? "active" : "lapsed";
  }

  if (subscription.status === "canceled") return "lapsed";
  return subscription.stripeSubscriptionId || subscription.paidThroughDate ? "active" : "lapsed";
}

/** Convenience wrapper for call sites that only need the yes/no. */
export async function hasLiveBillingAccess(ownerType: BillingOwnerType, ownerId: string): Promise<boolean> {
  return (await getBillingAccessStatus(ownerType, ownerId)) === "active";
}
