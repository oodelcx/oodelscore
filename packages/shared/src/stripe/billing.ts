import type Stripe from "stripe";
import { Types } from "mongoose";
import { getStripeClient } from "./client";
import {
  BillingSubscription,
  BILLING_OWNER_TYPES,
  DEFAULT_PRODUCT_LINE_ITEMS,
  type BillingOwnerType,
  type IBillingSubscription,
  type CompPeriod,
} from "../models/BillingSubscription";
import { Invoice } from "../models/Invoice";
import { Business, type IBusiness } from "../models/Business";
import { ParentOrganization, type IParentOrganization } from "../models/ParentOrganization";
import { User } from "../models/User";
import { sendTemplatedEmail } from "../email/resend";
import { PRICING_INTERVALS, type IPricingTerms } from "../models/common";
import { PRODUCTS, hasProduct, type Product } from "../models/products";

/** Which field on Business/ParentOrganization carries a given product's price. */
function pricingTermsField(product: Product): "pricingTerms" | "cePricingTerms" {
  return product === "colleague_experience" ? "cePricingTerms" : "pricingTerms";
}

/** Which field on Business carries the Stripe subscription item ID covering that product's group_pays coverage. */
function groupPaysItemField(product: Product): "groupPaysStripeSubscriptionItemId" | "ceGroupPaysStripeSubscriptionItemId" {
  return product === "colleague_experience" ? "ceGroupPaysStripeSubscriptionItemId" : "groupPaysStripeSubscriptionItemId";
}

function productLabel(product: Product): string {
  return product === "colleague_experience" ? "Colleague Experience" : "Customer Experience";
}

/**
 * Legacy Price lookup_keys from before per-owner custom pricing (Admin sets
 * a real dollar amount in-app now — see IPricingTerms — instead of picking
 * from a fixed catalog). Kept only so derivePlanKey() can still recognise
 * `plan` correctly on subscriptions created before this change; nothing
 * creates a Checkout Session against these anymore.
 */
export const CHECKOUT_PLANS = ["business_monthly", "business_yearly"] as const;
export type CheckoutPlan = (typeof CHECKOUT_PLANS)[number];

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

/** Reads whatever Admin has set on the Business/ParentOrganization record — never a Stripe lookup. */
async function getPricingTermsForOwner(ownerType: BillingOwnerType, ownerId: string, product: Product): Promise<IPricingTerms> {
  const field = pricingTermsField(product);
  if (ownerType === "business") {
    const business = await Business.findById(ownerId).select(field);
    if (!business) throw new BillingError("Business not found");
    return business[field];
  }
  const org = await ParentOrganization.findById(ownerId).select(field);
  if (!org) throw new BillingError("Parent organization not found");
  return org[field];
}

/**
 * Every product this owner is enabled for AND would be billed for directly
 * through its own checkout/subscription — i.e. not a business currently
 * riding its parent org's subscription via "group_pays" (that business has
 * no line items of its own at all; its branch-level coverage is handled by
 * syncBranchGroupPaysCoverage instead).
 */
async function getDirectlyBilledProducts(
  ownerType: BillingOwnerType,
  owner: Pick<IBusiness, "enabledProducts" | "billingAssignment"> | Pick<IParentOrganization, "enabledProducts">
): Promise<Product[]> {
  if (ownerType === "business" && "billingAssignment" in owner && owner.billingAssignment === "group_pays") return [];
  return PRODUCTS.filter((p) => hasProduct(owner, p));
}

/**
 * Creates a Stripe Checkout Session (hosted, redirect-based — no Stripe.js
 * or publishable key needed) for a business or parent org to pay for
 * whatever Admin has priced them at (IPricingTerms on their own record),
 * one line item per enabled+priced product (Customer Experience and/or
 * Colleague Experience). Builds each Stripe price inline (`price_data`)
 * from the stored amount — Admin never creates a Price in the Stripe
 * Dashboard. Each line item's inline Product carries `metadata.product` so
 * the webhook can map the resulting subscription/session items back to
 * which product they cover. The webhook (checkout.session.completed) is
 * what actually persists the resulting subscription/payment — this only
 * starts the flow.
 *
 * A single Checkout Session is either "payment" mode (one-time — for
 * annual_lump_sum) or "subscription" mode — it can't be both. If the owner
 * has one product priced annual_lump_sum and another priced monthly/
 * annual_monthly_rate, that combination can't check out together; Admin
 * has to align both products' pricing intervals first.
 */
export async function createCheckoutSessionForOwner(params: {
  ownerType: BillingOwnerType;
  ownerId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  if (params.ownerType === "business") {
    await assertBusinessCanHaveOwnSubscription(params.ownerId);
  }

  const owner =
    params.ownerType === "business" ? await Business.findById(params.ownerId) : await ParentOrganization.findById(params.ownerId);
  if (!owner) throw new BillingError(params.ownerType === "business" ? "Business not found" : "Parent organization not found");

  const directlyBilledProducts = await getDirectlyBilledProducts(params.ownerType, owner);
  const priced = await Promise.all(
    directlyBilledProducts.map(async (product) => ({ product, terms: await getPricingTermsForOwner(params.ownerType, params.ownerId, product) }))
  );
  const withPrice = priced.filter((p) => p.terms.amount !== null && p.terms.interval);
  if (withPrice.length === 0) {
    throw new BillingError("Set a price for at least one enabled product before creating a checkout link.");
  }

  const lumpSum = withPrice.filter((p) => p.terms.interval === "annual_lump_sum");
  const recurring = withPrice.filter((p) => p.terms.interval !== "annual_lump_sum");
  if (lumpSum.length > 0 && recurring.length > 0) {
    throw new BillingError(
      "This account's products are priced on different billing types (annual lump sum vs. a recurring rate) — align both products' pricing interval before checkout."
    );
  }

  const { name, email } = await resolveOwnerNameEmail(params.ownerType, params.ownerId);
  const customerId = await getOrCreateStripeCustomer({ ownerType: params.ownerType, ownerId: params.ownerId, email, name });

  const stripe = getStripeClient();
  const products = withPrice.map((p) => p.product).join(",");
  const metadata = { ownerType: params.ownerType, ownerId: params.ownerId, products };
  // Same reasoning as before: Stripe's Managed Payments mode requires every
  // product to carry a tax_code, which an inline price_data product
  // doesn't — disable it per-session so checkout always works.
  const managedPayments = { enabled: false } as const;

  if (lumpSum.length > 0) {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: lumpSum.map(({ product, terms }) => ({
        price_data: {
          currency: terms.currency,
          unit_amount: Math.round(terms.amount! * 100),
          product_data: { name: `${name} — ${productLabel(product)} annual subscription`, metadata: { product } },
        },
        quantity: 1,
      })),
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata,
      managed_payments: managedPayments,
    });
    if (!session.url) throw new BillingError("Stripe did not return a checkout URL");
    return session.url;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: recurring.map(({ product, terms }) => ({
      price_data: {
        currency: terms.currency,
        unit_amount: Math.round(terms.amount! * 100),
        recurring: { interval: "month" },
        product_data: { name: `${name} — ${productLabel(product)} subscription`, metadata: { product } },
      },
      quantity: 1,
    })),
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata,
    subscription_data: { metadata },
    managed_payments: managedPayments,
  });

  if (!session.url) throw new BillingError("Stripe did not return a checkout URL");
  return session.url;
}

// A business/org self-canceling its own subscription from the Stripe portal
// is never how OodelCX wants cancellation to happen — per CLAUDE.md,
// cancellation is something we do on request, not something a customer
// does unilaterally. Stripe's default portal configuration includes a
// self-service "Cancel subscription" button unless a configuration says
// otherwise, so every portal session this app creates is pinned to a
// restricted configuration with that one feature turned off — everything
// else (payment method update, invoice history, customer details) mirrors
// whatever the account's own default configuration already allows, so this
// never silently disables something Admin set up in the Stripe Dashboard.
const RESTRICTED_PORTAL_CONFIG_NAME = "OodelCX — no self-cancel";
let cachedRestrictedPortalConfigId: string | null = null;

async function getRestrictedPortalConfigurationId(stripe: Stripe): Promise<string> {
  if (cachedRestrictedPortalConfigId) return cachedRestrictedPortalConfigId;

  // Reuse one already created (idempotent across cold starts / redeploys)
  // rather than accumulating a new configuration on every call.
  const existing = await stripe.billingPortal.configurations.list({ limit: 100 });
  const found = existing.data.find((c) => c.name === RESTRICTED_PORTAL_CONFIG_NAME);
  if (found) {
    cachedRestrictedPortalConfigId = found.id;
    return found.id;
  }

  const defaults = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
  const base = defaults.data[0];

  const created = await stripe.billingPortal.configurations.create({
    name: RESTRICTED_PORTAL_CONFIG_NAME,
    business_profile: base
      ? {
          headline: base.business_profile.headline ?? undefined,
          privacy_policy_url: base.business_profile.privacy_policy_url || undefined,
          terms_of_service_url: base.business_profile.terms_of_service_url || undefined,
        }
      : undefined,
    features: {
      customer_update: base?.features.customer_update,
      invoice_history: base?.features.invoice_history,
      payment_method_update: base?.features.payment_method_update,
      subscription_cancel: { enabled: false },
    },
  });
  cachedRestrictedPortalConfigId = created.id;
  return created.id;
}

/** Stripe's hosted "manage my subscription/payment method" page. */
export async function createBillingPortalSession(stripeCustomerId: string, returnUrl: string): Promise<string> {
  const stripe = getStripeClient();
  const configuration = await getRestrictedPortalConfigurationId(stripe);
  const session = await stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: returnUrl, configuration });
  return session.url;
}

/**
 * Keeps one Business's Stripe coverage for one product in sync with its own
 * billingAssignment — the mechanism behind "an org's subscription covers
 * some, all, or none of its branches." Call this once per enabled product
 * whenever a business's billingAssignment or enabledProducts is written
 * (see the admin businesses PATCH route) — billingAssignment applies to
 * whichever product(s) the branch has, there's no separate per-product
 * assignment.
 *
 * "group_pays": adds a subscription item to the *org's* Stripe
 * subscription, priced from the org's own price for this product, and
 * remembers its ID on the business (groupPaysStripeSubscriptionItemId /
 * ceGroupPaysStripeSubscriptionItemId) so it can be removed precisely
 * later. Requires both the org to already have an active Stripe
 * subscription (start it from the Parent Org's own Billing tab first) and
 * the org to have a real recurring price set for this product — an
 * "annual_lump_sum" org price can't back a subscription item at all, since
 * a lump sum is a one-time charge, not a recurring line. Skipped
 * (no-op) for a product the branch doesn't have enabled.
 *
 * Anything else ("branch_pays", "unassigned"), or a product no longer
 * enabled on the branch: removes the item if one exists, so a branch
 * reassigned away from the org, or a product turned off, stops being
 * billed through it.
 */
export async function syncBranchGroupPaysCoverage(businessId: string, product: Product): Promise<void> {
  const business = await Business.findById(businessId);
  if (!business) throw new BillingError("Business not found");

  const stripe = getStripeClient();
  const itemField = groupPaysItemField(product);

  if (business.billingAssignment !== "group_pays" || !hasProduct(business, product)) {
    if (business[itemField]) {
      await stripe.subscriptionItems.del(business[itemField]);
      business[itemField] = "";
      await business.save();
    }
    return;
  }

  if (business[itemField]) return; // already covered

  if (!business.parentOrgId) throw new BillingError("A standalone business can't be billed group_pays — it has no parent org.");
  const org = await ParentOrganization.findById(business.parentOrgId);
  if (!org) throw new BillingError("Parent organization not found");

  const orgSubscription = await BillingSubscription.findOne({ ownerType: "parentOrg", ownerId: org._id });
  if (!orgSubscription?.stripeSubscriptionId) {
    throw new BillingError(
      `${org.name} has no active subscription yet — start its checkout from the Parent Org's own Billing tab before adding branches to it.`
    );
  }

  const orgTerms = org[pricingTermsField(product)];
  if (orgTerms.interval === "annual_lump_sum") {
    throw new BillingError(
      `${org.name}'s ${productLabel(product)} price is an annual lump sum, which can't cover a branch's ongoing subscription — change it to Monthly or "Annual commitment, billed monthly" first.`
    );
  }
  if (orgTerms.amount === null || !orgTerms.interval) {
    throw new BillingError(`Set a ${productLabel(product)} price for ${org.name} before it can cover any branch.`);
  }

  // Unlike a Checkout Session's line items, a subscription item's price_data
  // needs a real Product reference — no inline product_data — so create one
  // for this branch first.
  const stripeProduct = await stripe.products.create({
    name: `${business.name} — ${productLabel(product)}, covered by ${org.name}`,
    metadata: { businessId: business._id.toString(), parentOrgId: org._id.toString(), product },
  });

  const item = await stripe.subscriptionItems.create({
    subscription: orgSubscription.stripeSubscriptionId,
    price_data: {
      currency: orgTerms.currency,
      unit_amount: Math.round(orgTerms.amount * 100),
      recurring: { interval: "month" },
      product: stripeProduct.id,
    },
    quantity: 1,
    metadata: { businessId: business._id.toString(), product },
  });

  business[itemField] = item.id;
  await business.save();
}

/**
 * Bulk version for after an org's own subscription is first created — every
 * branch already sitting at billingAssignment "group_pays" from before the
 * org had anywhere to attach to gets its item(s) added now, one per product
 * the branch has enabled. Best-effort: one branch/product's failure (e.g. a
 * data issue) doesn't stop the rest from syncing.
 */
export async function syncGroupPaysBranchesForOrg(orgId: string): Promise<{ synced: number; failed: { businessId: string; message: string }[] }> {
  const branches = await Business.find({ parentOrgId: orgId, billingAssignment: "group_pays" });
  let synced = 0;
  const failed: { businessId: string; message: string }[] = [];
  for (const branch of branches) {
    for (const product of PRODUCTS) {
      if (!hasProduct(branch, product) || branch[groupPaysItemField(product)]) continue;
      try {
        await syncBranchGroupPaysCoverage(branch._id.toString(), product);
        synced++;
      } catch (err) {
        failed.push({ businessId: branch._id.toString(), message: err instanceof Error ? err.message : "Unknown error" });
      }
    }
  }
  return { synced, failed };
}

/**
 * Called after a business/org's enabledProducts is written (admin PATCH
 * routes). Two things need to stay in sync with whichever products are now
 * enabled: a business's own group_pays coverage per product (delegates to
 * syncBranchGroupPaysCoverage for each product), and — for whichever
 * products this owner is billed for *directly* — dropping any Stripe
 * subscription item for a product that's no longer enabled, so turning
 * Customer or Colleague Experience off actually stops billing for it
 * instead of leaving a stale line item on the invoice forever.
 */
export async function syncProductCoverageForOwner(ownerType: BillingOwnerType, ownerId: string): Promise<void> {
  if (ownerType === "business") {
    for (const product of PRODUCTS) {
      await syncBranchGroupPaysCoverage(ownerId, product);
    }
  }

  const owner = ownerType === "business" ? await Business.findById(ownerId) : await ParentOrganization.findById(ownerId);
  if (!owner) return;
  if (ownerType === "business" && "billingAssignment" in owner && owner.billingAssignment === "group_pays") return;

  const subscription = await BillingSubscription.findOne({ ownerType, ownerId });
  if (!subscription?.stripeSubscriptionId) return;

  const stripe = getStripeClient();
  let changed = false;
  for (const product of PRODUCTS) {
    if (hasProduct(owner, product)) continue;
    const itemId = subscription.productLineItems[product];
    if (!itemId) continue;
    await stripe.subscriptionItems.del(itemId);
    subscription.productLineItems[product] = "";
    changed = true;
  }
  if (changed) await subscription.save();
}

/**
 * The single action behind the Pricing card's "Save & push to Stripe"
 * button: saves the new amount/currency/interval on the Business or
 * ParentOrganization record, then immediately propagates it to whatever is
 * already live in Stripe — instead of a price change silently sitting in
 * Mongo until the next unrelated action happens to touch Stripe. Always
 * returns a plain-language status rather than throwing on "nothing to push
 * to yet," since that's a normal, expected state (a brand-new account).
 *
 * - Business with its own active subscription: updates that subscription's
 *   price directly.
 * - Parent org with an active subscription: propagates the new rate to
 *   every branch currently covered under it (each group_pays branch's own
 *   subscription item gets repriced) — the org's rate *is* the per-branch
 *   rate, there's no separate "org fee."
 * - Nothing active yet: just saves; the caller's own "Start checkout" /
 *   "Sync branch coverage" actions are what create something to push to.
 */
export async function savePricingAndPushToStripe(
  ownerType: BillingOwnerType,
  ownerId: string,
  product: Product,
  terms: { amount: number | null; currency: string; interval: string | null }
): Promise<string> {
  const validInterval = terms.interval === null || (PRICING_INTERVALS as readonly string[]).includes(terms.interval);
  const validAmount = terms.amount === null || (typeof terms.amount === "number" && terms.amount > 0);
  if (!validInterval || !validAmount) throw new BillingError("Invalid price");

  const field = pricingTermsField(product);
  const ownerExists =
    ownerType === "business"
      ? await Business.findByIdAndUpdate(ownerId, { $set: { [field]: terms } })
      : await ParentOrganization.findByIdAndUpdate(ownerId, { $set: { [field]: terms } });
  if (!ownerExists) throw new BillingError(ownerType === "business" ? "Business not found" : "Parent organization not found");

  const subscription = await BillingSubscription.findOne({ ownerType, ownerId });
  if (!subscription?.stripeSubscriptionId) {
    return "Price saved. No active subscription yet — start checkout below to begin billing at this rate.";
  }
  if (subscription.isComp) {
    return "Price saved. This account is on comp — convert it to paying to start billing at this rate.";
  }
  if (terms.amount === null || !terms.interval) {
    return "Price cleared.";
  }
  if (terms.interval === "annual_lump_sum") {
    return "Price saved. An annual lump-sum rate only applies the next time this account is charged — it can't change an existing subscription's price.";
  }

  const stripe = getStripeClient();

  if (ownerType === "business") {
    const itemId = subscription.productLineItems[product];
    if (!itemId) {
      return `Price saved, but ${productLabel(product)} isn't a line item on the existing subscription yet — use "Continue to payment" to add it.`;
    }
    const item = await stripe.subscriptionItems.retrieve(itemId);
    await stripe.subscriptionItems.update(itemId, {
      price_data: {
        currency: terms.currency,
        unit_amount: Math.round(terms.amount * 100),
        recurring: { interval: "month" },
        product: typeof item.price.product === "string" ? item.price.product : item.price.product.id,
      },
    });
    return "Price saved and pushed live to Stripe.";
  }

  // Parent org: reprice every branch already covered for this product, not the org itself.
  const itemField = groupPaysItemField(product);
  const coveredBranches = await Business.find({ parentOrgId: ownerId, [itemField]: { $ne: "" } });
  let repriced = 0;
  for (const branch of coveredBranches) {
    const branchItemId = branch[itemField];
    const item = await stripe.subscriptionItems.retrieve(branchItemId);
    await stripe.subscriptionItems.update(branchItemId, {
      price_data: {
        currency: terms.currency,
        unit_amount: Math.round(terms.amount * 100),
        recurring: { interval: "month" },
        product: typeof item.price.product === "string" ? item.price.product : item.price.product.id,
      },
    });
    repriced++;
  }
  return coveredBranches.length === 0
    ? "Price saved. No branches are covered under this org's subscription yet."
    : `Price saved and pushed live to Stripe for ${repriced} covered branch(es).`;
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
        // A fresh or changed expiry deserves its own reminder cycle.
        compExpiryReminderSentAt: null,
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
      const products = session.metadata?.products ?? "";
      if (!ownerType || !ownerId) break;

      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const stripe = getStripeClient();

      let stripeFields: Partial<IBillingSubscription>;

      if (session.mode === "payment") {
        // annual_lump_sum: a real one-time charge, not a Stripe
        // subscription — paidThroughDate (not nextPaymentDate) tracks when
        // this needs renewing, since Stripe won't auto-bill it again the
        // way a subscription would. No ongoing subscription item exists to
        // remember per product, so productLineItems stays empty here.
        const amountTotal = session.amount_total ?? 0;
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
        let paymentMethodLast4 = "";
        if (paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["payment_method"] });
          const pm = paymentIntent.payment_method;
          if (pm && typeof pm !== "string") paymentMethodLast4 = pm.card?.last4 ?? "";
        }
        stripeFields = {
          stripeSubscriptionId: "",
          plan: products || "annual_lump_sum",
          status: "active",
          // Normalised to a monthly figure like every other plan, so it
          // adds meaningfully into Billing Oversight's Platform MRR total.
          mrrValue: Math.round(amountTotal / 12) / 100,
          nextPaymentDate: null,
          paidThroughDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          lumpSumRenewalReminderSentAt: null,
          paymentMethodLast4,
        };
      } else {
        // A Checkout Session carries no price, interval, or payment-method
        // data of its own, so the subscription it just created is the only
        // place the MRR figure and the card's last 4 can come from. Without
        // this fetch `mrrValue` stays at its schema default of 0 and
        // `paymentMethodLast4` never gets set.
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["default_payment_method", "items.data.price.product"],
          });
          // Each line item's inline Product carries metadata.product (set
          // when the Checkout Session was created) — read it back so later
          // per-product repricing (savePricingAndPushToStripe) and
          // per-product removal (syncProductCoverageForOwner) know exactly
          // which item belongs to which product, instead of guessing.
          const productLineItems: Record<Product, string> = { ...DEFAULT_PRODUCT_LINE_ITEMS };
          for (const item of subscription.items.data) {
            const stripeProduct = item.price.product;
            const metaProduct = typeof stripeProduct === "string" ? undefined : (stripeProduct as Stripe.Product).metadata?.product;
            if (metaProduct === "customer_experience" || metaProduct === "colleague_experience") {
              productLineItems[metaProduct] = item.id;
            }
          }
          stripeFields = {
            ...subscriptionFieldsFromStripe(subscription, { planFallback: products }),
            paymentMethodLast4: await resolvePaymentMethodLast4(subscription),
            paidThroughDate: null,
            productLineItems,
          };
        } else {
          stripeFields = {
            stripeSubscriptionId: "",
            plan: products,
            status: "active",
            mrrValue: 0,
            nextPaymentDate: null,
            paymentMethodLast4: "",
          };
        }
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
        planFallback: subscription.metadata?.products ?? "",
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

/**
 * Daily sweep (task #139): reminds the account's own account manager 7 days
 * before a comp/pilot expires, so there's a real chance to convert it
 * before the payment gate (see packages/shared/src/billing/gate.ts) locks
 * the customer out. Dedup via compExpiryReminderSentAt — markOwnerComp()
 * clears it whenever the expiry itself changes, so extending a pilot
 * re-arms the reminder instead of it firing again for the old date.
 * Unlimited comp (compExpiresAt === null) never reminds — nothing to warn
 * about.
 */
export async function sendCompExpiryReminders(): Promise<{ reminded: number; skipped: number }> {
  let reminded = 0;
  let skipped = 0;

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const dueForReminder = await BillingSubscription.find({
    isComp: true,
    compExpiresAt: { $ne: null, $lte: sevenDaysFromNow, $gt: new Date() },
    compExpiryReminderSentAt: null,
  });

  for (const subscription of dueForReminder) {
    const accountManagerId =
      subscription.ownerType === "business"
        ? (await Business.findById(subscription.ownerId))?.accountManagerId
        : (await ParentOrganization.findById(subscription.ownerId))?.accountManagerId;
    if (!accountManagerId) {
      skipped++;
      continue;
    }
    const manager = await User.findById(accountManagerId);
    const { name } = await resolveOwnerNameEmail(subscription.ownerType, subscription.ownerId.toString()).catch(() => ({
      name: "(deleted account)",
    }));
    if (!manager) {
      skipped++;
      continue;
    }

    await sendTemplatedEmail("comp_expiry_reminder", manager.email, {
      name: manager.email,
      account_name: name,
      expires_on: subscription.compExpiresAt!.toISOString().slice(0, 10),
      account_link: `${process.env.APP_URL ?? ""}/admin/${subscription.ownerType === "business" ? "businesses" : "parent-orgs"}/${subscription.ownerId.toString()}`,
    }).catch((err) => console.error("[billing] failed to send comp_expiry_reminder", err));

    subscription.compExpiryReminderSentAt = new Date();
    await subscription.save();
    reminded++;
  }

  return { reminded, skipped };
}
