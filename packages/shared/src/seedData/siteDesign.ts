/**
 * Default copy for the redesigned marketing site (home, Customer X, Colleague
 * X, Solutions, plus the shared nav/cookie/demo-form text on the "menu" page).
 * Every string a visitor sees on those pages comes from a SiteContent field,
 * so everything here is editable from Admin -> Site Content; this file only
 * supplies the defaults a fresh database (or a doc that predates a field)
 * falls back to.
 */

const j = (v: unknown): string => JSON.stringify(v);

export type StageId = "capture" | "clarify" | "claim" | "close" | "confirm" | "none";

const STAGE_BY_TAG: Record<string, StageId> = {
  "Feedback Collection": "capture",
  "Colleague Feedback Collection": "capture",
  "Colleague Roster": "capture",
  "Theme Intelligence": "clarify",
  "Root Cause Investigation": "clarify",
  "Driver Analysis": "clarify",
  "Branch & Session Comparison": "clarify",
  "AI Insights Reports": "clarify",
  "CX ↔ EX Correlation": "clarify",
  "Case Management": "claim",
  "Automatic Alerts": "claim",
  "Guided Playbooks": "claim",
  "Escalation Workflows": "claim",
  "Sensitive-Category Routing": "claim",
  "Decision Log": "close",
  "Downloadable Reports": "close",
  "CX Pulse": "confirm",
  "Trend Benchmarking": "confirm",
  "Colleague Pulse Score": "confirm",
  eNPS: "confirm",
  "Roles, Permissions & Security": "none",
};

/** The C a feature belongs to when its stored record has no explicit `stage`. */
export function defaultStageForFeature(f: { tag?: string; group?: string }): StageId {
  if (f.tag && STAGE_BY_TAG[f.tag]) return STAGE_BY_TAG[f.tag];
  return f.group === "act" ? "claim" : "clarify";
}

const STAGE_DEFS = [
  { label: "Capture", def: "Collect feedback where it happens, in under a minute." },
  { label: "Clarify", def: "Turn a pile of comments into themes, causes and drivers." },
  { label: "Claim", def: "Every issue gets an owner and a due date." },
  { label: "Close", def: "Reply to the person, and log the decision that fixed it." },
  { label: "Confirm", def: "Know whether the loop is actually closing." },
];

const LADDER = [{ name: "Collecting" }, { name: "Reacting" }, { name: "Responding" }, { name: "Improving" }, { name: "Embedded" }];

/** Illustration text shared by every product page (labels, not product data). */
const VIZ_COMMON = {
  vizCaptureSend: "Send",
  vizCaptureComment: "Tell us more (optional)",
  vizCaptureQrTitle: "Scan a QR code",
  vizCaptureLinkTitle: "Or open a link",
  vizTracedBadge: "Why",
  vizNote: "Illustrative example. Figures are not real customer data.",
  vizBeforeLabel: "Before",
  vizAfterLabel: "After",
  vizLadder: j(LADDER),
  vizLadderLevel: "3",
  vizLadderNow: "You are here",
  vizLadderDone: "Reached",
  vizLadderNext: "Next",
  vizRouteFrom: "Colleague",
  vizRouteFromSub: "raises a concern",
  vizRouteManager: "Usual category owner",
  vizRouteBypassed: "not involved",
  vizRouteTo: "Designated contact",
  vizRouteToSub: "receives and owns the case",
  vizRouteCaption: "For categories marked sensitive, a concern goes straight to a person you choose.",
};

export const CX_VIZ = {
  ...VIZ_COMMON,
  vizCaptureTitle: "How was your visit?",
  vizCaptureNps: "How likely are you to recommend us?",
  vizCaptureQrSub: "Counter, receipt, door, wall",
  vizCaptureLinkSub: "Email, SMS, chat, intranet",
  vizThemes: j([
    { label: "Wait time", count: "14" },
    { label: "Cleanliness", count: "6" },
    { label: "Staff", count: "3" },
    { label: "Pricing", count: "2" },
  ]),
  vizTracedTitle: "Concentrated in one time window",
  vizTracedBody: "9 of 14 negative comments fall between 12:00 and 14:00",
  vizClaimStyle: "cases",
  vizCases: j([
    { initials: "!", title: "Star average below 3.5, Downtown", sub: "Alert sent to branch manager · 4 min ago", pill: "Alert", tone: "warn" },
    { initials: "SK", title: "Cleanliness dip, Downtown", sub: "Owner Sam K. · due in 2 days", pill: "Claimed", tone: "ok" },
    { initials: "RL", title: "Level 2: Regional lead", sub: "No movement within the set time, escalated", pill: "Escalated", tone: "ok" },
  ]),
  vizPlaybookChips: j(["Playbook: Staff Friendliness Recovery", "Review responses", "Coach team"]),
  vizDecisionInitials: "DL",
  vizDecisionTitle: "Self-checkout wait time",
  vizDecisionSub: "Logged with trigger and owner",
  vizBefore: "3.9",
  vizAfter: "4.6",
  vizReplyInitials: "✉",
  vizReplyTitle: "Reply sent where contact details were left",
  vizReplyQuote: "Thanks for telling us. The queue is fixed.",
  vizDashKpis: j([
    { label: "NPS", value: "42", delta: "+6" },
    { label: "CSAT", value: "4.3", delta: "+0.2" },
    { label: "CX Pulse", value: "49", delta: "L3" },
  ]),
  vizDashChips: j(["Wait time · 14", "Cleanliness · 6", "Staff · 3"]),
  vizDashCaseInitials: "SK",
  vizDashCaseTitle: "Cleanliness dip, Downtown",
  vizDashCaseSub: "Owner Sam K. · due in 2 days",
  vizDashCasePill: "Claimed",
  vizLadderCaption: "CX Pulse maturity",
};

export const EX_VIZ = {
  ...VIZ_COMMON,
  vizCaptureTitle: "How was your shift?",
  vizCaptureNps: "How likely are you to recommend working here?",
  vizCaptureQrSub: "Break room wall, shift-change screen",
  vizCaptureLinkSub: "Team chat, email, intranet",
  vizThemes: j([
    { label: "Scheduling", count: "9" },
    { label: "Equipment", count: "6" },
    { label: "Training", count: "3" },
    { label: "Pay clarity", count: "2" },
  ]),
  vizTracedTitle: "Concentrated in one time window",
  vizTracedBody: "6 of 9 negative comments fall between 20:00 and 22:00",
  vizClaimStyle: "route",
  vizCases: j([
    { initials: "HR", title: "Case opened, anonymous", sub: "Owner Smith · due in 3 days", pill: "Sensitive", tone: "warn" },
  ]),
  vizPlaybookChips: j(["Playbook: Rota Review", "Review responses", "Talk to the team"]),
  vizDecisionInitials: "DL",
  vizDecisionTitle: "Shift-swap policy change",
  vizDecisionSub: "Logged with trigger and owner",
  vizBefore: "31",
  vizAfter: "52",
  vizReplyInitials: "✉",
  vizReplyTitle: "Update sent to the whole roster",
  vizReplyQuote: "You raised it, we changed the rota.",
  vizDashKpis: j([
    { label: "eNPS", value: "38", delta: "+6" },
    { label: "Open cases", value: "4", delta: "-2" },
    { label: "Colleague Pulse", value: "49", delta: "L3" },
  ]),
  vizDashChips: j(["Scheduling · 9", "Equipment · 6", "Training · 3"]),
  vizDashCaseInitials: "HR",
  vizDashCaseTitle: "Rota concern, Branch 4",
  vizDashCaseSub: "Owner Smith · due in 3 days",
  vizDashCasePill: "Claimed",
  vizLadderCaption: "Colleague Pulse maturity",
};

export { SOLUTION_INDUSTRIES } from "./siteIndustries";
import { SOLUTION_INDUSTRIES } from "./siteIndustries";

/** New/overridden fields per page. Merged over the older seed in siteContent.ts. */
export const DESIGN_FIELDS: Record<string, Record<string, string>> = {
  menu: {
    navSignInLabel: "Sign in",
    navDemoLabel: "Book a demo",
    mobileMenuOpenLabel: "Open menu",
    mobileMenuCloseLabel: "Close menu",
    cookieTitle: "Cookies, kept minimal.",
    cookieBody: "We use a necessary session cookie to keep you signed in — nothing else runs unless you allow it. See our",
    cookiePrivacyLabel: "Privacy policy",
    cookieNecessaryButton: "Necessary only",
    cookieAcceptButton: "Accept all",
    demoTitle: "Book a demo",
    demoSub: "Twenty minutes, a live walkthrough of real workflows — not a canned script.",
    demoLabelName: "Name",
    demoLabelEmail: "Work email",
    demoLabelCompany: "Company",
    demoLabelMessage: "What would you like to see?",
    demoSubmit: "Request a demo",
    demoSubmitting: "Sending…",
    demoSuccessTitle: "Thanks — we’ll be in touch.",
    demoSuccessBody: "Someone from our team will reach out at {email} to set up a time.",
    demoError: "Something went wrong — try again.",
  },
  home: {
    heroEyebrow: "Feedback intelligence",
    heroSubheadline:
      "OodelCX turns every response — a QR scan or a shared link, from a customer or a colleague — into tracked, owned work, not another number on a dashboard nobody opens. Built for one location or a thousand.",
    heroSecondaryHref: "#loop",
    heroBuiltForLabel: "Built for",
    loopSubhead: "Most tools stop at Capture. OodelCX covers the other four, so a score always has somewhere to go.",
    loopStepFormat: "{n} of {total} · {label}",
    loopStages: j([
      { label: "Capture", title: "Collect", body: "A QR code or a link, a short survey, no app or login." },
      { label: "Clarify", title: "Make sense of it", body: "Themes, root causes, and drivers surfaced automatically." },
      { label: "Claim", title: "Own it", body: "An owned case in Case Management, not a comment nobody reads." },
      { label: "Close", title: "Follow through", body: "Reply to the person who raised it and log the decision that fixed it." },
      { label: "Confirm", title: "Know if it worked", body: "CX Pulse tracks whether the loop is actually closing." },
    ]),
    heroTwoProductsEyebrow: "Two products, one engine",
    heroTwoProductsCxLabel: "For customers, clients, patients",
    heroTwoProductsCeLabel: "For your own people",
    doorCxBullets: j(["QR or link feedback in under a minute", "Cases with owners and due dates", "CX Pulse tracks real improvement"]),
    doorCeBullets: j(["Anonymous by design, tied to real teams", "Sensitive routing straight to HR", "eNPS and Colleague Pulse in one view"]),
    industriesEyebrow: "Solutions",
    industriesHeadline: "Built for the places feedback gets lost.",
    finalCtaSecondaryButton: "See pricing",
    finalCtaSecondaryHref: "/pricing",
  },
  "customer-x": {
    heroEyebrow: "Customer X",
    heroHeadline: "Everything from a QR code or link to a resolved decision.",
    heroPrimaryButton: "Book a demo",
    heroSecondaryButton: "See Colleague X",
    heroSecondaryHref: "/colleague-x",
    heroChips: j(["No app, no login", "Cases with owners", "Measured outcomes"]),
    heroVisual: "dashboard",
    railNote: "5C Framework",
    stepLabelFormat: "Step {n} of {total}",
    stageDefs: j(STAGE_DEFS),
    alwaysOnLabel: "Always on",
    alwaysOnText: "Roles, permissions and two-factor security on every plan",
    industriesEyebrow: "Where it fits",
    industriesHeadline: "Used across the industries you serve.",
    finalCtaSecondaryButton: "See pricing",
    finalCtaSecondaryHref: "/pricing",
    ...CX_VIZ,
  },
  "colleague-x": {
    heroEyebrow: "Colleague X",
    heroHeadline: "The same rigor, pointed at your own team.",
    heroPrimaryButton: "Book a demo",
    heroSecondaryButton: "See Customer X",
    heroSecondaryHref: "/customer-x",
    heroChips: j(["Anonymous by design", "Routes to HR", "eNPS included"]),
    heroVisual: "route",
    railNote: "5C Framework",
    stepLabelFormat: "Step {n} of {total}",
    stageDefs: j(STAGE_DEFS),
    alwaysOnLabel: "Always on",
    alwaysOnText: "Anonymity controls, roles and two-factor security on every plan",
    industriesEyebrow: "Where it fits",
    industriesHeadline: "Used across the industries you serve.",
    finalCtaSecondaryButton: "See pricing",
    finalCtaSecondaryHref: "/pricing",
    ...EX_VIZ,
  },
  solutions: {
    eyebrow: "Solutions",
    productCxLabel: "Customer X",
    productExLabel: "Colleague X",
    primaryButton: "Book a demo",
    secondaryButtonCx: "How Customer X works",
    secondaryButtonEx: "How Colleague X works",
    sceneEyebrow: "How it plays out",
    sceneNote: "Illustrative example.",
    challengeLabel: "The challenge",
    measuresLabel: "What you can measure",
    usesLabel: "How OodelCX helps",
    measuresNote: "Categories are set when the survey is built, so each organisation chooses its own.",
    otherEyebrow: "Other industries",
    otherHeadline: "Same engine, different context.",
    industryDetails: j(SOLUTION_INDUSTRIES),
  },
  pricing: {
    pricingEyebrow: "Pricing",
    enterpriseLinkLabel: "Talk to us about volume pricing →",
  },
  company: {
    demoEyebrow: "Book a demo",
    demoHeadline: "Twenty minutes, on real workflows.",
    demoBody:
      "Tell us about your organization and which product you are interested in. We will show the whole loop on a scenario like yours.",
    demoProductLabel: "Interested in",
    demoProductOptions: j(["Customer X", "Colleague X", "Both"]),
    demoEmailPrefix: "Prefer email?",
    audienceLinkLabel: "See how it works for your industry →",
  },
  contact: {
    formLabelName: "Name",
    formLabelEmail: "Email",
    formLabelCompany: "Company (optional)",
    formLabelMessage: "Message",
    formSubmit: "Send message",
    formSubmitting: "Sending…",
    formErrName: "Name is required.",
    formErrEmail: "A valid email is required.",
    formErrMessage: "Message is required.",
    formErrGeneric: "Something went wrong — try again.",
  },
};

interface FeatureLike {
  tag?: string;
  group?: string;
  stage?: string;
  menuFeatured?: boolean;
  headline?: string;
  [k: string]: unknown;
}

/** Adds `stage` to every seeded feature, drops the retired menu flag, and applies QR-or-link wording. */
export function withStages(featuresJson: string): string {
  const list = JSON.parse(featuresJson) as FeatureLike[];
  return j(
    list.map((f) => {
      const { menuFeatured: _menuFeatured, ...rest } = f;
      void _menuFeatured;
      const out: FeatureLike = { ...rest, stage: f.stage ?? defaultStageForFeature(f) };
      if (out.headline === "A QR code your team actually uses, not an annual survey they dread") {
        out.headline = "A QR code or link your team actually uses, not an annual survey they dread";
      }
      return out;
    }),
  );
}
