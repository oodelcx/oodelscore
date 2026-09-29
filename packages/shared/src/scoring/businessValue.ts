import type { Types } from "mongoose";
import { Response } from "../models/Response";
import type { IBusinessValueInputs } from "../models/Business";
import type { Product } from "../models/products";

/**
 * The £/$ business-value module: translates negative feedback into a
 * commercial number, using only figures each business enters about its own
 * business (spec: standard field NAMES, each business's own VALUES — never
 * requires integrating with a real finance/accounting system for v1).
 *
 * "At risk" is deliberately the same negative-feedback signal already used
 * elsewhere in the app (a star_1_5 answer at or below a threshold, default
 * 2 — see responseStats.ts's negative count) rather than a new definition,
 * so this reads as the same "negative feedback" a business already sees on
 * Analytics, just priced.
 */
export interface BusinessValueImpact {
  inputsComplete: boolean; // false when any required input is still null — never show a computed number built from a guess
  atRiskCount: number;
  annualCustomerValue: number | null; // avgTransactionValue * visitsPerYear
  revenueAtRisk: number | null; // atRiskCount * annualCustomerValue
  replacementCost: number | null; // atRiskCount * acquisitionCost
  totalExposure: number | null; // revenueAtRisk + replacementCost
  currencySymbol: string;
}

export async function computeBusinessValueImpact(
  businessId: Types.ObjectId | string,
  from: Date,
  to: Date,
  inputs: IBusinessValueInputs,
  product: Product = "customer_experience"
): Promise<BusinessValueImpact> {
  const threshold = inputs.atRiskStarThreshold ?? 2;
  const responses = await Response.find({ businessId, product, submittedAt: { $gte: from, $lte: to } })
    .select("answers")
    .lean();

  let atRiskCount = 0;
  for (const response of responses) {
    const isAtRisk = response.answers.some(
      (a) => a.type === "star_1_5" && typeof a.value === "number" && a.value <= threshold
    );
    if (isAtRisk) atRiskCount += 1;
  }

  const inputsComplete =
    inputs.avgTransactionValue !== null && inputs.visitsPerYear !== null && inputs.acquisitionCost !== null;

  const annualCustomerValue = inputsComplete ? (inputs.avgTransactionValue as number) * (inputs.visitsPerYear as number) : null;
  const revenueAtRisk = annualCustomerValue !== null ? Math.round(atRiskCount * annualCustomerValue * 100) / 100 : null;
  const replacementCost = inputsComplete ? Math.round(atRiskCount * (inputs.acquisitionCost as number) * 100) / 100 : null;
  const totalExposure = revenueAtRisk !== null && replacementCost !== null ? Math.round((revenueAtRisk + replacementCost) * 100) / 100 : null;

  return {
    inputsComplete,
    atRiskCount,
    annualCustomerValue,
    revenueAtRisk,
    replacementCost,
    totalExposure,
    currencySymbol: inputs.currencySymbol || "£",
  };
}
