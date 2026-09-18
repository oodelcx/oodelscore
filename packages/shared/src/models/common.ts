import { Schema } from "mongoose";

export interface IAddress {
  street: string;
  city: string;
  postcode: string;
}

export const AddressSchema = new Schema<IAddress>(
  {
    street: { type: String, default: "" },
    city: { type: String, default: "" },
    postcode: { type: String, default: "" },
  },
  { _id: false }
);

/**
 * Red/amber/green banding for the two headline metrics (star average, NPS)
 * used by the Group Command Center and anywhere else a business/branch
 * needs a traffic-light read. A value >= the green minimum is green,
 * >= the amber minimum (but below green) is amber, otherwise red.
 * Admin sets this once per Parent Org — every branch under it inherits the
 * same bands — and independently per standalone business (spec: "standalone
 * businesses will be set" with their own ranges).
 */
export interface IRagThresholds {
  starGreenMin: number; // e.g. 3.7
  starAmberMin: number; // e.g. 3.0
  npsGreenMin: number; // e.g. 30
  npsAmberMin: number; // e.g. 0
}

export const DEFAULT_RAG_THRESHOLDS: IRagThresholds = {
  starGreenMin: 3.7,
  starAmberMin: 3.0,
  npsGreenMin: 30,
  npsAmberMin: 0,
};

export const RagThresholdsSchema = new Schema<IRagThresholds>(
  {
    starGreenMin: { type: Number, default: DEFAULT_RAG_THRESHOLDS.starGreenMin },
    starAmberMin: { type: Number, default: DEFAULT_RAG_THRESHOLDS.starAmberMin },
    npsGreenMin: { type: Number, default: DEFAULT_RAG_THRESHOLDS.npsGreenMin },
    npsAmberMin: { type: Number, default: DEFAULT_RAG_THRESHOLDS.npsAmberMin },
  },
  { _id: false }
);

export function ragBandForStar(value: number | null, thresholds: IRagThresholds): "green" | "amber" | "red" | null {
  if (value === null) return null;
  if (value >= thresholds.starGreenMin) return "green";
  if (value >= thresholds.starAmberMin) return "amber";
  return "red";
}

export function ragBandForNps(value: number | null, thresholds: IRagThresholds): "green" | "amber" | "red" | null {
  if (value === null) return null;
  if (value >= thresholds.npsGreenMin) return "green";
  if (value >= thresholds.npsAmberMin) return "amber";
  return "red";
}

/**
 * How Admin's own price for a business/parent org actually gets charged —
 * set once here, read at Checkout time to build Stripe pricing inline, so
 * Admin never has to create a Price in the Stripe Dashboard themselves:
 * - "monthly": a real recurring Stripe subscription, billed every month.
 * - "annual_monthly_rate": still a real recurring Stripe subscription,
 *   billed monthly — just at whatever (usually lower) rate Admin sets for
 *   an annual commitment, as opposed to the plain monthly rate.
 * - "annual_lump_sum": one real one-time charge covering a year, not a
 *   Stripe subscription at all — BillingSubscription.paidThroughDate is
 *   what tracks when it needs renewing, since Stripe won't auto-bill it
 *   again the way a subscription would.
 */
export const PRICING_INTERVALS = ["monthly", "annual_monthly_rate", "annual_lump_sum"] as const;
export type PricingInterval = (typeof PRICING_INTERVALS)[number];

/** Admin-set, never touches Stripe until a Checkout Session actually needs it. */
export interface IPricingTerms {
  amount: number | null; // major currency units (e.g. 49.00), null = not set yet
  currency: string; // lowercase ISO 4217, e.g. "usd"
  interval: PricingInterval | null; // null = not set yet
}

export const DEFAULT_PRICING_TERMS: IPricingTerms = { amount: null, currency: "usd", interval: null };

export const PricingTermsSchema = new Schema<IPricingTerms>(
  {
    amount: { type: Number, default: null },
    currency: { type: String, default: "usd" },
    interval: { type: String, enum: PRICING_INTERVALS, default: null },
  },
  { _id: false }
);
