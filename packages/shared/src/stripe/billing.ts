import type Stripe from "stripe";
import { Types } from "mongoose";
import { getStripeClient } from "./client";
import {
  BillingSubscription,
  BILLING_OWNER_TYPES,
  type BillingOwnerType,
  type IBillingSubscription,
  type CompPeriod,
} from "../models/BillingSubscription";
import { Invoice } from "../models/Invoice";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { User } from "../models/User";
import { sendTemplatedEmail } from "../email/resend";

export const CHECKOUT_PLANS = ["business_monthly", "business_yearly"] as const;
export type CheckoutPlan = (typeof CHECKOUT_PLANS)[number];

const PRICE_ENV_VARS: Record<CheckoutPlan, string> = {
  business_monthly: "STRIPE_PRICE_ID_MONTHLY",
  business_yearly: "STRIPE_PRICE_ID_YEARLY",
};

export class BillingError extends Error {}

/**
 * Enforces spec Section 5 / bug #4: a business with billingAssignment
 * "group_pays" must never get its own billingSubscriptions row — its cost
 * rolls into the parent org's single subscription instead. Call before
 * creating any business-level subscription (checkout or comp).
 */
export async function assertBusinessCanHaveOwnSubscription(businessId: string): Promise<void> {
  const business = await Business.findById(businessId);
  if (!business) throw new BillingError("Business not found");
  if (business.billingAssignment === "group_pays") {
    throw new BillingError(
      'This business is billed via its parent organization ("group_pays") — it cannot have its own subscription. Change its billing assignment first.'
    );
  }
}

async function resolveOwnerNameEmail(ownerType: BillingOwnerType, ownerId: string): Promise<{ name: string; email: string }> {
  if (ownerType === "business") {
    const business = await Business.findById(ownerId);
    if (!business) throw new BillingError("Business not found");
    return { name: business.name, email: business.contactEmail || "" };
  }
  const org = await ParentOrganization.findById(ownerId);
  if (!org) throw new BillingError("Parent organization not found");
  return { name: org.name, email: org.contactEmail || "" };
}

/** The account-side user to notify for billing emails (owner's login, not Admin). */
async function findBillingContactUser(ownerType: BillingOwnerType, ownerId: Types.ObjectId | string) {
  const accountType = ownerType === "business" ? "business" : "parent_org";
  return User.findOne({ accountType, parentId: ownerId });
}

async function getOrCreateStripeCustomer(params: {
  ownerType: BillingOwnerType;
  ownerId: string;
  email: string;
  name: string;
}): Promise<string> {
  const existing = await BillingSubscription.findOne({ ownerType: params.ownerType, ownerId: params.ownerId });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: params.email || undefined,
    name: params.name,
    metadata: { ownerType: params.ownerType, ownerId: params.ownerId },
  });
  return customer.id;
}

/**
 * Creates a Stripe Checkout Session (hosted, redirect-based — no Stripe.js
 * or publishable key needed) for a business or parent org to subscribe to
 * a plan. The webhook (checkout.session.completed) is what actually
 * persists the resulting subscription — this only starts the flow.
 */
export async function createCheckoutSessionForOwner(params: {
  ownerType: BillingOwnerType;
  ownerId: string;
  plan: CheckoutPlan;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  if (params.ownerType === "business") {
    await assertBusinessCanHaveOwnSubscription(params.ownerId);
  }

  const priceId = process.env[PRICE_ENV_VARS[params.plan]];
  if (!priceId) {
    throw new BillingError(`No Stripe Price configured for plan "${params.plan}" — set ${PRICE_ENV_VARS[params.plan]}`);
  }

  const { name, email } = await resolveOwnerNameEmail(params.ownerType, params.ownerId);
  const customerId = await getOrCreateStripeCustomer({ ownerType: params.ownerType, ownerId: params.ownerId, email, name });

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { ownerType: params.ownerType, ownerId: params.ownerId, plan: params.plan },
    subscription_data: { metadata: { ownerType: params.ownerType, ownerId: params.ownerId, plan: params.plan } },
    // Stripe's newer "Managed Payments" (merchant-of-record) mode is
    // enabled by default on new accounts and requires every product to
    // carry a tax_code, which ours don't. We don't need Managed Payments
    // for a straightforward B2B subscription — disable it per-session so
    // checkout works regardless of the account's default setting.
    managed_payments: { enabled: false },
  });

  if (!session.url) throw new BillingError("Stripe did not return a checkout URL");
  return session.url;
}

/** Stripe's hosted "manage my subscription/payment method" page. */
export async function createBillingPortalSession(stripeCustomerId: string, returnUrl: string): Promise<string> {
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: returnUrl });
  return session.url;
}

/**
 * Powers the "Download" action on an Invoice History row (Business/Group
 * Billing pages). Read-only — no Stripe side effect — so it's safe to call
 * directly on click, unlike checkout/portal actions.
 */
export async function getInvoiceHostedUrl(stripeInvoiceId: string): Promise<string | null> {
  if (!stripeInvoiceId) return null;
  const stripe = getStripeClient();
  const invoice = await stripe.invoices.retrieve(stripeInvoiceId);
  return invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null;
}

/**
 * A comp account's expiry given its period, computed from `startedAt`
 * (defaults to now) — "unlimited" and "custom" are the only two cases with
 * no automatic date math: unlimited never expires, custom takes whatever
 * date Admin picked directly.
 */
export function computeCompExpiry(period: CompPeriod, startedAt: Date, customExpiresAt?: Date | null): Date | null {
  switch (period) {
    case "15_days":
      return new Date(startedAt.getTime() + 15 * 24 * 60 * 60 * 1000);
    case "30_days":
      return new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    case "60_days":
      return new Date(startedAt.getTime() + 60 * 24 * 60 * 60 * 1000);
    case "unlimited":
      return null;
    case "custom":
      return customExpiresAt ?? null;
  }
}

/**
 * Marks an owner as comp (spec Section 5: "bypasses Stripe charge but
 * should still be visible in Billing Oversight with a comp badge"). No
 * Stripe API calls — this is a direct DB write. `period` drives an
 * editable expiry (15/30/60 days, unlimited, or a custom date) — Admin can
 * call this again later with a new period to change it, since it's an
 * upsert keyed on the owner.
 */
export async function markOwnerComp(params: {
  ownerType: BillingOwnerType;
  ownerId: string;
  period: CompPeriod;
  customExpiresAt?: Date | null;
}): Promise<IBillingSubscription> {
  if (params.ownerType === "business") {
    await assertBusinessCanHaveOwnSubscription(params.ownerId);
  }
  const startedAt = new Date();
  const compExpiresAt = computeCompExpiry(params.period, startedAt, params.customExpiresAt);
  const subscription = await BillingSubscription.findOneAndUpdate(
    { ownerType: params.ownerType, ownerId: params.ownerId },
    {
      $set: {
        ownerType: params.ownerType,
        ownerId: params.ownerId,
        isComp: true,
        compPeriod: params.period,
        compStartedAt: startedAt,
        compExpiresAt,
        mrrValue: 0,
        status: "active",
        plan: "comp",
      },
    },
    { upsert: true, new: true }
  );
  return subscription;
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): "active" | "overdue" | "canceled" {
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") return "canceled";
  if (status === "past_due") return "overdue";
  return "active";
}

/** Average days in a Gregorian month — 365.25 / 12. */
const DAYS_PER_MONTH = 30.4375;

const MONTHS_PER_INTERVAL: Record<Stripe.Price.Recurring.Interval, number> = {
  day: 1 / DAYS_PER_MONTH,
  week: 7 / DAYS_PER_MONTH,
  month: 1,
  year: 12,
};

/**
 * Monthly recurring revenue for a Stripe subscription, in major currency
 * units (dollars, not cents). Every billing interval is normalised to a
 * month so Billing Oversight's "Platform MRR" tile can add a yearly plan
 * and a monthly plan together and get a number that means something: a
 * $490/year plan contributes $40.83/mo, not $490.
 *
 * Tiered and metered prices carry no `unit_amount` and contribute 0 — we
 * don't sell any today, and inventing a figure for one would be worse than
 * an obvious zero.
 */
export function computeSubscriptionMrr(subscription: Stripe.Subscription): number {
  let centsPerMonth = 0;

  for (const item of subscription.items.data) {
    const recurring = item.price?.recurring;
    const unitAmount = item.price?.unit_amount;
    if (!recurring || unitAmount === null || unitAmount === undefined) continue;

    const months = MONTHS_PER_INTERVAL[recurring.interval] * (recurring.interval_count || 1);
    if (months <= 0) continue;

    centsPerMonth += (unitAmount * (item.quantity ?? 1)) / months;
  }

  return Math.round(centsPerMonth) / 100;
}

/**
 * Our `plan` key for a Stripe subscription. `setup-stripe-prices.ts` gives
 * each Price a lookup_key matching one of CHECKOUT_PLANS, so reading it
 * back keeps `plan` right after a plan change made in the Stripe billing
 * portal — the subscription's metadata still names whatever plan it was
 * created on.
 *
 * Only a lookup_key we recognise is used. Anything else (a Price made by
 * hand in the Dashboard, say) falls back to the metadata, so a stray
 * lookup_key can't invent a new plan and fragment Billing Oversight's
 * by-plan breakdown.
 */
function derivePlanKey(subscription: Stripe.Subscription, fallback: string): string {
  const lookupKey = subscription.items.data[0]?.price?.lookup_key;
  if (lookupKey && (CHECKOUT_PLANS as readonly string[]).includes(lookupKey)) return lookupKey;
  return fallback;
}

/**
 * The fields a Stripe subscription owns on our local billingSubscriptions
 * row. Checkout and the customer.subscription.* events both write through
 * here, so a plan change or a cancellation can never leave `mrrValue`
 * reporting the revenue of a plan the customer is no longer on.
 */
function subscriptionFieldsFromStripe(
  subscription: Stripe.Subscription,
  options: { deleted?: boolean; planFallback?: string } = {}
): Partial<IBillingSubscription> {
  const status = options.deleted ? "canceled" : mapStripeSubscriptionStatus(subscription.status);
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const plan = derivePlanKey(subscription, options.planFallback ?? "");

  return {
    stripeSubscriptionId: subscription.id,
    status,
    // A canceled subscription bills nothing further, so it has to stop
    // counting towards MRR the moment it ends — otherwise churned revenue
    // inflates the Platform MRR total forever.
    mrrValue: status === "canceled" ? 0 : computeSubscriptionMrr(subscription),
    nextPaymentDate: status === "canceled" || !periodEnd ? null : new Date(periodEnd * 1000),
    // Never blank out an existing plan just because Stripe gave us nothing
    // to replace it with.
    ...(plan ? { plan } : {}),
  };
}

/**
 * The last 4 digits of the card behind a subscription, for the "Card
 * ending ____" line on the Business/Group billing pages. Never populated
 * before this fix — only the demo seed set it, so every real customer's
 * billing page silently omitted it.
 *
 * A subscription's own `default_payment_method` wins when set; otherwise
 * falls back to the customer's default payment method (the common case —
 * Checkout typically sets the customer's default rather than the
 * subscription's own). Returns "" (never populated in the UI) if neither
 * resolves to a card, e.g. a payment method type with no `card` field.
 */
async function resolvePaymentMethodLast4(subscription: Stripe.Subscription): Promise<string> {
  const stripe = getStripeClient();
  const dpm = subscription.default_payment_method;

  // Already expanded by the caller (checkout handler passes
  // { expand: ["default_payment_method"] }) — no extra API call needed.
  if (dpm && typeof dpm !== "string") return dpm.card?.last4 ?? "";

  let paymentMethodId = dpm ?? null;
  if (!paymentMethodId) {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    if (!customerId) return "";
    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) return "";
    const customerDefault = customer.invoice_settings?.default_payment_method;
    paymentMethodId = typeof customerDefault === "string" ? customerDefault : (customerDefault?.id ?? null);
  }
  if (!paymentMethodId) return "";

  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  return paymentMethod.card?.last4 ?? "";
}

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

async function recordInvoiceAndNotify(invoice: Stripe.Invoice, status: "paid" | "failed"): Promise<void> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const subscription = await BillingSubscription.findOne({ stripeCustomerId: customerId });
  if (!subscription) return; // no matching local subscription (yet) — nothing to record against

  const amount = (status === "paid" ? invoice.amount_paid : invoice.amount_due) ?? 0;

  await Invoice.findOneAndUpdate(
    { stripeInvoiceId: invoice.id },
    {
      $set: {
        subscriptionId: subscription._id,
        ownerType: subscription.ownerType,
        ownerId: subscription.ownerId,
        amount: amount / 100,
        currency: invoice.currency,
        status,
        stripeInvoiceId: invoice.id ?? "",
        paymentMethodLast4: subscription.paymentMethodLast4,
        issuedAt: invoice.created ? new Date(invoice.created * 1000) : new Date(),
      },
    },
    { upsert: true }
  );

  if (status === "failed") {
    subscription.status = "overdue";
    await subscription.save();
  }

  const recipient = await findBillingContactUser(subscription.ownerType, subscription.ownerId);
  if (!recipient) return;

  if (status === "paid") {
    await sendTemplatedEmail("invoice_receipt", recipient.email, {
      name: recipient.email,
      invoice_amount: formatCurrency(amount / 100, invoice.currency),
    });
  } else {
    const { name } = await resolveOwnerNameEmail(subscription.ownerType, subscription.ownerId.toString());
    await sendTemplatedEmail("payment_failed", recipient.email, {
      name: recipient.email,
      business_name: name,
      billing_link: process.env.APP_URL ? `${process.env.APP_URL}/admin/billing` : "",
    });
  }
}

/**
 * Processes a verified Stripe webhook event. The route handler's only job
 * is verifying the signature and calling this — keeps that logic testable
 * independent of the HTTP layer.
 */
export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const ownerType = session.metadata?.ownerType as BillingOwnerType | undefined;
      const ownerId = session.metadata?.ownerId;
      const plan = session.metadata?.plan ?? "";
      if (!ownerType || !ownerId) break;

      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

      // A Checkout Session carries no price, interval, or payment-method
      // data, so the subscription it just created is the only place the
      // MRR figure and the card's last 4 can come from. Without this fetch
      // `mrrValue` stays at its schema default of 0 and `paymentMethodLast4`
      // never gets set — both invisible on Billing Oversight and the
      // account's own billing page.
      let stripeFields: Partial<IBillingSubscription> = {
        stripeSubscriptionId: "",
        plan,
        status: "active",
        mrrValue: 0,
        nextPaymentDate: null,
        paymentMethodLast4: "",
      };
      if (subscriptionId) {
        const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId, {
          expand: ["default_payment_method"],
        });
        stripeFields = {
          ...subscriptionFieldsFromStripe(subscription, { planFallback: plan }),
          paymentMethodLast4: await resolvePaymentMethodLast4(subscription),
        };
      }

      await BillingSubscription.findOneAndUpdate(
        { ownerType, ownerId },
        {
          $set: {
            ownerType,
            ownerId,
            stripeCustomerId: customerId ?? "",
            isComp: false,
            ...stripeFields,
          },
        },
        { upsert: true }
      );
      break;
    }

    case "invoice.payment_succeeded": {
      await recordInvoiceAndNotify(event.data.object as Stripe.Invoice, "paid");
      break;
    }

    case "invoice.payment_failed": {
      await recordInvoiceAndNotify(event.data.object as Stripe.Invoice, "failed");
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const ownerType = subscription.metadata?.ownerType as BillingOwnerType | undefined;
      const ownerId = subscription.metadata?.ownerId;
      if (!ownerType || !ownerId) break;

      const deleted = event.type === "customer.subscription.deleted";
      const fields: Partial<IBillingSubscription> = subscriptionFieldsFromStripe(subscription, {
        deleted,
        planFallback: subscription.metadata?.plan ?? "",
      });
      // Skip the extra Stripe lookups on cancellation — the card that used
      // to be on file isn't worth an API call once there's no active
      // subscription to bill it against.
      if (!deleted) {
        fields.paymentMethodLast4 = await resolvePaymentMethodLast4(subscription);
      }

      // `isComp: { $ne: true }` so a lingering Stripe subscription can't
      // undo an Admin comp — markOwnerComp() deliberately pins the row to
      // plan "comp" at 0 MRR, and a stray subscription.updated arriving
      // afterwards must not price it back up.
      await BillingSubscription.findOneAndUpdate({ ownerType, ownerId, isComp: { $ne: true } }, { $set: fields });
      break;
    }

    default:
      break;
  }
}

export interface BillingIntegrityIssues {
  /** billingSubscriptions rows whose ownerId no longer resolves to a real Business/ParentOrganization (bug #4's "Account: Unknown"). */
  orphanedSubscriptionIds: string[];
  /** businesses with billingAssignment "group_pays" that still have their own subscription row — should never happen given the guards above, but this is the safety-net check spec Section 5 asks for. */
  groupPaysWithOwnSubscriptionIds: string[];
}

/**
 * Spec Section 5's "DB-level safeguard... or a nightly integrity check
 * job" for bug #4. Read-only — reports issues, doesn't fix them (fixing
 * means a human decides whether to delete the row or reassign the owner).
 */
export async function findBillingIntegrityIssues(): Promise<BillingIntegrityIssues> {
  const orphanedSubscriptionIds: string[] = [];
  const groupPaysWithOwnSubscriptionIds: string[] = [];

  const subscriptions = await BillingSubscription.find();
  for (const sub of subscriptions) {
    if (!BILLING_OWNER_TYPES.includes(sub.ownerType)) continue;

    if (sub.ownerType === "business") {
      const business = await Business.findById(sub.ownerId);
      if (!business) {
        orphanedSubscriptionIds.push(sub._id.toString());
        continue;
      }
      if (business.billingAssignment === "group_pays") {
        groupPaysWithOwnSubscriptionIds.push(sub._id.toString());
      }
    } else {
      const org = await ParentOrganization.findById(sub.ownerId);
      if (!org) orphanedSubscriptionIds.push(sub._id.toString());
    }
  }

  return { orphanedSubscriptionIds, groupPaysWithOwnSubscriptionIds };
}
