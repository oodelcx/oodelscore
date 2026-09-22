import { BillingSubscription, type BillingOwnerType } from "../models/BillingSubscription";

/**
 * The payment gate: true once an owner has either a live comp period or a
 * real Stripe subscription/payment behind them — false for "never checked
 * out," "comp expired," or "subscription canceled." Business/Group layouts
 * use this to decide whether to render the portal or the locked screen; the
 * Billing page itself is always let through regardless (see middleware.ts +
 * the layouts' x-pathname check) so there's always a way to pay.
 */
export async function hasLiveBillingAccess(ownerType: BillingOwnerType, ownerId: string): Promise<boolean> {
  const subscription = await BillingSubscription.findOne({ ownerType, ownerId });
  if (!subscription) return false;

  if (subscription.isComp) {
    if (!subscription.compExpiresAt) return true; // unlimited comp
    return subscription.compExpiresAt.getTime() > Date.now();
  }

  if (subscription.status === "canceled") return false;
  return Boolean(subscription.stripeSubscriptionId || subscription.paidThroughDate);
}
