import { MIN_ANONYMITY_GROUP_SIZE } from "../anonymity";
import type { BusinessMetrics } from "./aggregate";
import type { Product } from "../models/products";

/**
 * Colleague Experience anonymity floor for any per-location metric block:
 * with fewer than MIN_ANONYMITY_GROUP_SIZE responses the response count stays
 * (so a screen can explain why) but every score is removed. A no-op for the
 * customer product. The one place this rule lives for BusinessMetrics, so the
 * dashboard, Command Center, Overview and branch pages cannot drift apart.
 */
export function maskBusinessMetricsForAnonymity(metrics: BusinessMetrics, product: Product): BusinessMetrics {
  if (product !== "colleague_experience" || metrics.responseCount >= MIN_ANONYMITY_GROUP_SIZE) return metrics;
  return {
    ...metrics,
    starAverage: null,
    npsScore: null,
    csatPercent: null,
    cesAverage: null,
    cesLowEffortPercent: null,
    starCount: 0,
    npsCount: 0,
    csatCount: 0,
    cesCount: 0,
  };
}
