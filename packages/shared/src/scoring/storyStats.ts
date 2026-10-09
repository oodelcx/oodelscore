/**
 * Pure statistics and rules behind the Customer <-> Staff story (no database).
 * Everything here is deterministic and unit-tested, and every claim the page
 * makes can be traced back to one of these functions.
 */

export const AT_RISK_STAR = 3.5;
export const AT_RISK_ENPS = 0;

export interface Point {
  x: number; // staff eNPS
  y: number; // customer star average
}

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function sd(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs) as number;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n)) as number;
  const my = mean(ys.slice(0, n)) as number;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

function ranks(xs: number[]): number[] {
  const idx = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
    const r = (i + j) / 2 + 1; // average rank for ties
    for (let k = i; k <= j; k++) out[idx[k].i] = r;
    i = j + 1;
  }
  return out;
}

/** Rank correlation: robust to one extreme branch pulling the line. */
export function spearman(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  return pearson(ranks(xs.slice(0, n)), ranks(ys.slice(0, n)));
}

export type Strength = "strong" | "moderate" | "weak" | "none";
export type Confidence = "reasonable" | "directional" | "insufficient";

export interface CorrelationSummary {
  n: number;
  r: number | null;
  rho: number | null;
  /** 95% confidence interval for r (Fisher z). Null under 4 points. */
  ci: [number, number] | null;
  strength: Strength;
  direction: "positive" | "negative" | "none";
  confidence: Confidence;
  /** True when the interval excludes zero: the link is unlikely to be chance. */
  distinguishableFromZero: boolean;
}

export function strengthOf(r: number | null): Strength {
  if (r === null) return "none";
  const a = Math.abs(r);
  return a >= 0.6 ? "strong" : a >= 0.35 ? "moderate" : a >= 0.15 ? "weak" : "none";
}

export function confidenceForBranches(n: number): Confidence {
  return n >= 30 ? "reasonable" : n >= 12 ? "directional" : "insufficient";
}

export function summariseCorrelation(points: Point[]): CorrelationSummary {
  const n = points.length;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const r = pearson(xs, ys);
  const rho = spearman(xs, ys);
  let ci: [number, number] | null = null;
  if (r !== null && n > 3) {
    const z = Math.atanh(Math.max(-0.999999, Math.min(0.999999, r)));
    const se = 1 / Math.sqrt(n - 3);
    ci = [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)];
  }
  return {
    n,
    r,
    rho,
    ci,
    strength: strengthOf(r),
    direction: r === null || Math.abs(r) < 0.15 ? "none" : r > 0 ? "positive" : "negative",
    confidence: confidenceForBranches(n),
    distinguishableFromZero: ci !== null && (ci[0] > 0 || ci[1] < 0),
  };
}

export interface Regression {
  slope: number;
  intercept: number;
  residualSd: number;
}

/** Least squares of customer stars on staff eNPS. */
export function regress(points: Point[]): Regression | null {
  if (points.length < 5) return null;
  const mx = mean(points.map((p) => p.x)) as number;
  const my = mean(points.map((p) => p.y)) as number;
  let sxy = 0, sxx = 0;
  for (const p of points) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const resid = points.map((p) => p.y - (intercept + slope * p.x));
  const residualSd = sd(resid);
  if (residualSd === null || residualSd === 0) return null;
  return { slope, intercept, residualSd };
}

/** How many residual standard deviations a branch's customer score sits from what its staff score predicts. Negative = customers worse than expected. */
export function residualSigma(point: Point, reg: Regression | null): number | null {
  if (!reg) return null;
  return Math.round(((point.y - (reg.intercept + reg.slope * point.x)) / reg.residualSd) * 10) / 10;
}

export type Quadrant = "both_low" | "staff_low" | "customer_low" | "both_ok";

export function quadrantOf(cxStar: number | null, ceEnps: number | null): Quadrant | null {
  if (cxStar === null || ceEnps === null) return null;
  const cxLow = cxStar < AT_RISK_STAR;
  const ceLow = ceEnps < AT_RISK_ENPS;
  return cxLow && ceLow ? "both_low" : ceLow ? "staff_low" : cxLow ? "customer_low" : "both_ok";
}

export const QUADRANT_COPY: Record<Quadrant, { label: string; meaning: string }> = {
  both_low: { label: "Struggling on both", meaning: "Customers and staff are both unhappy. Start here." },
  staff_low: { label: "Staff unhappy, customers fine", meaning: "An early warning: service holds for now, but unhappy teams usually show in customer scores later." },
  customer_low: { label: "Customers unhappy, staff fine", meaning: "Not a people problem. Look at process, product, facilities or wait times." },
  both_ok: { label: "Healthy on both", meaning: "Customers and staff are both positive. Learn from these branches." },
};

export interface LagResult {
  /** Weeks by which staff movement comes before customer movement. 0 means they move together. */
  bestLagWeeks: number;
  r: number;
  r0: number | null;
  pairs: number;
  /** Only true when staff clearly lead customers (best lag above 0, |r| >= 0.5 and 0.1 better than moving together). */
  staffLeads: boolean;
}

/**
 * Does a change in staff sentiment come before a change in customer
 * scores? Correlates staff[t] with customer[t + lag] over weeks where both
 * exist. Needs at least six paired weeks at a lag to count.
 */
export function laggedCorrelation(staff: (number | null)[], customer: (number | null)[], maxLag = 4): LagResult | null {
  let best: { lag: number; r: number; pairs: number } | null = null;
  let r0: number | null = null;
  for (let lag = 0; lag <= maxLag; lag++) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let t = 0; t + lag < staff.length && t + lag < customer.length; t++) {
      const s = staff[t];
      const c = customer[t + lag];
      if (s !== null && c !== null) { xs.push(s); ys.push(c); }
    }
    if (xs.length < 6) continue;
    const r = pearson(xs, ys);
    if (r === null) continue;
    if (lag === 0) r0 = r;
    if (!best || Math.abs(r) > Math.abs(best.r)) best = { lag, r, pairs: xs.length };
  }
  if (!best) return null;
  const staffLeads = best.lag > 0 && Math.abs(best.r) >= 0.5 && Math.abs(best.r) - Math.abs(r0 ?? 0) >= 0.1;
  return { bestLagWeeks: best.lag, r: best.r, r0, pairs: best.pairs, staffLeads };
}

// ---------------------------------------------------------------------------
// Linking what staff say to what customers say (plausible links, never "causes")
// ---------------------------------------------------------------------------

export type StaffConcept = "workload" | "leadership" | "development" | "morale" | "pay" | "tools";
export type CustomerConcept = "speed" | "courtesy" | "accuracy" | "cleanliness" | "communication" | "facilities" | "value" | "digital";

const STAFF_RULES: [StaffConcept, RegExp][] = [
  ["workload", /workload|understaff|short.?staff|staffing|roster|rota|schedul|shift|overtime|work.?life|burnout|hours|stress/i],
  ["leadership", /manager|leadership|supervisor|management|feedback from|direction/i],
  ["development", /training|career|growth|skill|onboard|learning|promotion|develop/i],
  ["morale", /morale|culture|team|recogni|engage|belong|respect|motivat/i],
  ["pay", /\bpay\b|compensation|salary|wage|bonus|benefit|incentive/i],
  ["tools", /equipment|tool|system|software|resource|machine|supplies|technology/i],
];

const CUSTOMER_RULES: [CustomerConcept, RegExp][] = [
  ["speed", /wait|slow|speed|queue|delay|turnaround|long time|waiting/i],
  ["courtesy", /friendl|attitude|rude|courte|polite|staff behav|helpful|respect/i],
  ["accuracy", /accura|error|mistake|wrong|quality|reliab|result|food quality|product/i],
  ["cleanliness", /clean|hygien|restroom|toilet|dirty|sanit/i],
  ["communication", /communicat|information|explain|update|clarity/i],
  ["facilities", /facilit|seating|parking|space|crowd|comfort|access/i],
  ["value", /value|pric|cost|fee|expens|charge/i],
  ["digital", /app\b|online|website|digital|checkout|portal|booking/i],
];

export function staffConceptOf(theme: string): StaffConcept | null {
  for (const [c, re] of STAFF_RULES) if (re.test(theme)) return c;
  return null;
}
export function customerConceptOf(theme: string): CustomerConcept | null {
  for (const [c, re] of CUSTOMER_RULES) if (re.test(theme)) return c;
  return null;
}

export const STAFF_LABEL: Record<StaffConcept, string> = {
  workload: "Workload and rostering",
  leadership: "Manager and leadership support",
  development: "Training and growth",
  morale: "Team morale and culture",
  pay: "Pay and recognition",
  tools: "Tools and equipment",
};
export const CUSTOMER_LABEL: Record<CustomerConcept, string> = {
  speed: "Wait times and speed",
  courtesy: "Staff friendliness",
  accuracy: "Accuracy and quality",
  cleanliness: "Cleanliness",
  communication: "Communication",
  facilities: "Facilities",
  value: "Value for money",
  digital: "Digital experience",
};

/** Plausible staff-to-customer links, each with a plain reason and how strong the supporting research is. */
export const BRIDGE: { staff: StaffConcept; customer: CustomerConcept; weight: number; reason: string }[] = [
  { staff: "workload", customer: "speed", weight: 1, reason: "Short-staffed or over-rostered teams serve more slowly." },
  { staff: "workload", customer: "courtesy", weight: 0.8, reason: "Stretched colleagues have less patience for customers." },
  { staff: "workload", customer: "cleanliness", weight: 0.5, reason: "With no spare time, upkeep slips." },
  { staff: "leadership", customer: "courtesy", weight: 0.8, reason: "Teams that feel unsupported by their manager tend to be less warm with customers." },
  { staff: "leadership", customer: "accuracy", weight: 0.6, reason: "Little coaching and oversight shows up as more mistakes." },
  { staff: "development", customer: "accuracy", weight: 1, reason: "Under-trained teams make more errors." },
  { staff: "development", customer: "communication", weight: 0.7, reason: "Staff who were never taught the process explain it poorly." },
  { staff: "morale", customer: "courtesy", weight: 1, reason: "Low morale is felt by customers as indifference or rudeness." },
  { staff: "pay", customer: "courtesy", weight: 0.5, reason: "Pay frustration lowers engagement and raises turnover." },
  { staff: "tools", customer: "speed", weight: 0.9, reason: "Slow or broken systems and equipment hold the queue up." },
  { staff: "tools", customer: "accuracy", weight: 0.6, reason: "Poor tools lead to rework and errors." },
  { staff: "tools", customer: "digital", weight: 0.7, reason: "The same systems staff struggle with are what customers touch." },
];

export interface ConceptSignal {
  negative: number;
  total: number;
}

export interface LinkedPainPoint {
  staff: StaffConcept;
  customer: CustomerConcept;
  staffLabel: string;
  customerLabel: string;
  staffNegative: number;
  customerNegative: number;
  reason: string;
  score: number;
}

/** Minimum negative mentions on each side before a link is worth showing; staff counts are aggregate only, which is also what keeps them anonymous. */
export const MIN_SIDE_MENTIONS = 3;

export function linkPainPoints(staff: Map<StaffConcept, ConceptSignal>, customer: Map<CustomerConcept, ConceptSignal>, limit = 4): LinkedPainPoint[] {
  const out: LinkedPainPoint[] = [];
  for (const b of BRIDGE) {
    const s = staff.get(b.staff);
    const c = customer.get(b.customer);
    if (!s || !c || s.negative < MIN_SIDE_MENTIONS || c.negative < MIN_SIDE_MENTIONS) continue;
    out.push({
      staff: b.staff,
      customer: b.customer,
      staffLabel: STAFF_LABEL[b.staff],
      customerLabel: CUSTOMER_LABEL[b.customer],
      staffNegative: s.negative,
      customerNegative: c.negative,
      reason: b.reason,
      score: Math.round(Math.min(s.negative, c.negative) * b.weight * 10) / 10,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** One plain-language line per finding, written from the numbers only (no model involved). */
export function nextStepFor(p: LinkedPainPoint): string {
  switch (p.staff) {
    case "workload": return "Review rostering and cover at the busiest hours, and check whether the team is short-staffed.";
    case "leadership": return "Ask the branch manager for a short plan to give the team regular feedback and support.";
    case "development": return "Plan a refresher or on-the-job training on the areas customers complain about.";
    case "morale": return "Hold a team conversation about what is hurting morale, and recognise good work visibly.";
    case "pay": return "Check pay and incentives against the area, and raise it with your people team.";
    case "tools": return "Audit the systems and equipment the team relies on, and fix the slowest first.";
  }
}
