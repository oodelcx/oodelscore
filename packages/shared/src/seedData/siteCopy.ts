/**
 * Marketing copy, version 2.
 *
 * Positioning: customer experience (and colleague experience) is an
 * organisational function in its own right, like finance or HR. It needs a
 * named owner, a defined process, a reporting cycle and evidence of results.
 * The copy describes the problem plainly and what OodelCX does about it,
 * without comparing against or criticising other vendors.
 *
 * These values are layered over the older seed in siteContent.ts and are also
 * applied once to existing databases (see `applyCopyV2Migration` in db.ts), so
 * every key here is still editable from Admin -> Site Content afterwards.
 */
import { SOLUTION_INDUSTRIES, CX_VIZ, EX_VIZ, defaultStageForFeature } from "./siteDesign";

const j = (v: unknown): string => JSON.stringify(v);

type Feature = { tag: string; group: "understand" | "act"; headline: string; body: string };

const withStage = (list: Feature[]): string =>
  j(list.map((f) => ({ ...f, stage: defaultStageForFeature(f) })));

const CX_FEATURES: Feature[] = [
  {
    tag: "Feedback Collection",
    group: "understand",
    headline: "Feedback collected where the service takes place",
    body: "A QR code or a link is placed at the point of service. Respondents answer on their own phone in under a minute, with no app or account, and responses reach the dashboard straight away.",
  },
  {
    tag: "CX Pulse",
    group: "understand",
    headline: "A measure of how well feedback is managed",
    body: "Five dimensions — awareness, response speed, ownership, culture and measured outcomes — are combined into one maturity score. It shows whether feedback is shaping decisions, not only how satisfied customers are.",
  },
  {
    tag: "Theme Intelligence",
    group: "understand",
    headline: "Recurring themes identified across open comments",
    body: "Open-text responses are grouped into themes automatically, so an increase in a particular concern is visible as it begins rather than weeks later.",
  },
  {
    tag: "Root Cause Investigation",
    group: "understand",
    headline: "From symptom to underlying cause",
    body: "For a category that is falling, the platform gathers the evidence: change against the previous period, the two-hour windows where negative comments cluster, the branches with the lowest scores, and any earlier decision. It then explains that evidence, labelled likely, inferred or uncertain.",
  },
  {
    tag: "Driver Analysis",
    group: "understand",
    headline: "The categories that move the overall score",
    body: "Shows which rated categories correlate most closely with satisfaction and NPS, so effort is directed to the areas that affect results.",
  },
  {
    tag: "Branch & Session Comparison",
    group: "understand",
    headline: "Comparison across branches, shifts and sessions",
    body: "Results can be compared between branches or, for training and events, between sessions and facilitators, so differences are not hidden inside a single blended average.",
  },
  {
    tag: "Trend Benchmarking",
    group: "understand",
    headline: "Every score set against its own history",
    body: "Scores are shown against previous weeks, months and quarters, so a change can be judged against normal variation rather than read in isolation.",
  },
  {
    tag: "AI Insights Reports",
    group: "understand",
    headline: "Scheduled summaries in plain language",
    body: "Weekly, monthly, quarterly and yearly reports are generated from the recorded data, limited to what the data supports, and reviewed before they are shared outside your team.",
  },
  {
    tag: "Case Management",
    group: "act",
    headline: "A defined place for corrective work",
    body: "Flagged feedback becomes a case with a named owner, a due date and a status. Every change is kept in one timeline, so each issue has a clear line of responsibility.",
  },
  {
    tag: "Automatic Alerts",
    group: "act",
    headline: "Notification when a threshold is crossed",
    body: "Thresholds can be set for a score decline, a sudden dip or an outlier branch. The responsible person is notified when one is reached, rather than at the end of the reporting period.",
  },
  {
    tag: "Guided Playbooks",
    group: "act",
    headline: "Agreed responses recorded in advance",
    body: "For recurring issues, a Playbook attaches the steps the organisation has already agreed and records each one as it is completed.",
  },
  {
    tag: "Decision Log",
    group: "act",
    headline: "A record of what was changed and its effect",
    body: "Significant changes are logged with the trigger, the owner and a before-and-after comparison, marked with how much data sits behind it, so the organisation has evidence of what worked.",
  },
  {
    tag: "Escalation Workflows",
    group: "act",
    headline: "Escalation when a case is not progressing",
    body: "You define the escalation chain and the time allowed at each level. A case with no movement moves up to the next level, so the person with authority to act is informed in good time.",
  },
  {
    tag: "Downloadable Reports",
    group: "act",
    headline: "Reports prepared for governance meetings",
    body: "Export a structured report for any period for board, franchise or regulatory review, without assembling the data by hand.",
  },
  {
    tag: "Roles, Permissions & Security",
    group: "act",
    headline: "Access matched to responsibility",
    body: "Per-person permissions control which areas each team member can open, so access matches responsibility. Two-factor authentication protects every login, and sensitive account changes are recorded in an audit log.",
  },
];

const EX_FEATURES: Feature[] = [
  {
    tag: "Colleague Feedback Collection",
    group: "understand",
    headline: "A short, regular channel for colleague feedback",
    body: "The same brief, no-login survey is available by QR code or link in a break room, on a shift-change screen or in a message, so concerns about rotas or safety are raised when they occur rather than once a year.",
  },
  {
    tag: "Colleague Pulse Score",
    group: "understand",
    headline: "A measure of how colleague feedback is managed",
    body: "The same five-dimension maturity framework as CX Pulse — awareness, response speed, ownership, culture and measured outcomes — applied to colleague listening.",
  },
  {
    tag: "eNPS",
    group: "understand",
    headline: "Employee Net Promoter Score, with a trend",
    body: "eNPS is tracked alongside Colleague Pulse rather than compiled separately each quarter, so the result can be read as a trend instead of a single snapshot.",
  },
  {
    tag: "Sensitive-Category Routing",
    group: "understand",
    headline: "Concerns about a manager do not reach that manager",
    body: "Categories you mark as sensitive, such as HR complaints or leadership concerns, skip the usual category owner and go to a designated contact. Comments that appear to concern a senior person are also screened.",
  },
  {
    tag: "Colleague Roster",
    group: "understand",
    headline: "Feedback linked to teams, not an anonymous pool",
    body: "A roster by location and role lets patterns be read by branch or team, while individual responses stay anonymous. Results for any group with fewer than five responses are never shown.",
  },
  {
    tag: "CX ↔ EX Correlation",
    group: "understand",
    headline: "The relationship between colleague and customer experience",
    body: "Where both products are in use, the platform shows whether a change in colleague sentiment at a branch is followed by a change in customer sentiment.",
  },
  {
    tag: "Theme Intelligence",
    group: "understand",
    headline: "Recurring themes in colleague comments",
    body: "Themes such as understaffing, equipment or scheduling are identified automatically from open-text answers.",
  },
  {
    tag: "AI Insights Reports",
    group: "understand",
    headline: "Scheduled summaries of colleague sentiment",
    body: "Weekly, monthly, quarterly and yearly reports are generated from recorded responses and reviewed before they are shared beyond HR or leadership.",
  },
  {
    tag: "Case Management",
    group: "act",
    headline: "Concerns tracked to resolution",
    body: "The same Case Management used for customer feedback gives each colleague concern an owner, a due date and a status.",
  },
  {
    tag: "Guided Playbooks",
    group: "act",
    headline: "Agreed responses to recurring concerns",
    body: "A recurring issue, such as an equipment fault or a scheduling pattern, attaches a Playbook with the steps already agreed.",
  },
  {
    tag: "Decision Log",
    group: "act",
    headline: "Changes recorded with their measured effect",
    body: "A rota change or a new onboarding process is logged with its trigger and a before-and-after measure.",
  },
  {
    tag: "Automatic Alerts",
    group: "act",
    headline: "Notification when sentiment changes",
    body: "A fall in Colleague Pulse or eNPS, or an outlier branch, triggers an alert to the responsible person.",
  },
];

/** Bump when the copy below changes, so each page is rewritten once more (and only once) per revision. */
export const COPY_REV = "3";

const FINAL_CTA_SUB = "A twenty-minute walkthrough using a scenario close to your own.";

const FOOTER_COLUMNS = j([
  {
    heading: "Products",
    links: [
      { label: "Customer X", href: "/customer-x" },
      { label: "Colleague X", href: "/colleague-x" },
      { label: "Pricing", href: "/pricing" },
      { label: "The 5C Framework", href: "/#loop" },
    ],
  },
  {
    heading: "Solutions",
    links: [
      { label: "Banking & Finance", href: "/solutions/banking" },
      { label: "Education", href: "/solutions/education" },
      { label: "Retail", href: "/solutions/retail" },
      { label: "Healthcare", href: "/solutions/healthcare" },
      { label: "Telecom", href: "/solutions/telecom" },
      { label: "Airlines & Aviation", href: "/solutions/airlines" },
      { label: "Non-profit & NGOs", href: "/solutions/nonprofit" },
      { label: "Automotive", href: "/solutions/automotive" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/company" },
      { label: "Book a demo", href: "/company#demo" },
      { label: "Sign in", href: "/login" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
]);

export const COPY_V2: Record<string, Record<string, string>> = {
  menu: {
    footerColumns: FOOTER_COLUMNS,
    footerEmail: "hello@oodelscore.com",
    footerTagline: "Customer X and Colleague X can each be used on their own, or together.",
    footerDescription:
      "OodelCX provides the structure to run customer and colleague experience as an organisational function: feedback captured at every location, issues assigned and resolved, and outcomes measured over time.",
    cookieBody: "We use a necessary session cookie to keep you signed in. Nothing else runs unless you allow it. See our",
    demoSub: FINAL_CTA_SUB,
    demoSuccessBody: "A member of our team will contact you at {email} to arrange a time.",
  },
  home: {
    heroEyebrow: "Customer experience as an organisational function",
    heroHeadline: "Customer experience is a core organisational function.",
    heroSubheadline:
      "Like finance or HR, it needs an owner, a defined process, a reporting cycle and evidence of results. OodelCX gives organisations the operating structure to run it that way: feedback captured at every location, issues assigned and resolved, and outcomes measured over time.",
    metaDescription:
      "OodelCX gives organisations a structured way to run customer and colleague experience as a core function: capture feedback, assign ownership, resolve issues and measure outcomes.",
    heroSecondaryButton: "See the framework",
    heroBuiltForLine: "bank branch networks, retail chains, school trusts, healthcare groups",
    loopEyebrow: "The 5C Framework",
    loopHeadline: "Capture. Clarify. Claim. Close. Confirm.",
    loopSubhead:
      "Collecting feedback is one stage of a longer process. The 5C Framework sets out the whole process as five defined stages, each with an owner and a record.",
    loopStages: j([
      { label: "Capture", title: "Collect", body: "Feedback gathered at the point of service by QR code or link. No app, no login." },
      { label: "Clarify", title: "Understand", body: "Comments grouped into themes, then traced to causes and drivers." },
      { label: "Claim", title: "Assign", body: "Every issue is given a named owner and a due date in Case Management." },
      { label: "Close", title: "Resolve", body: "The person who raised it receives a reply, and the decision taken is recorded." },
      { label: "Confirm", title: "Verify", body: "CX Pulse measures whether the process is working and how mature it is." },
    ]),
    heroTwoProductsEyebrow: "Two products, one operating model",
    heroTwoProductsHeadline: "One operating model for the two groups every organisation depends on.",
    heroTwoProductsBody:
      "Customer X covers the people an organisation serves. Colleague X covers the people who serve them. Each can be used on its own, or both together. They share the same framework, case management and maturity measure, so the two can be read side by side.",
    heroTwoProductsCxLabel: "The people you serve",
    heroTwoProductsCxBody: "How customers, clients and patients experience the organisation after each interaction.",
    heroTwoProductsCeLabel: "The people who work for you",
    heroTwoProductsCeBody:
      "How colleagues experience their work, including concerns that should reach HR rather than a line manager.",
    doorCxBullets: j([
      "Feedback by QR code or link in under a minute",
      "Issues assigned to an owner with a due date",
      "CX Pulse measures how mature the function is",
    ]),
    doorCeBullets: j([
      "Anonymous by design, linked to real teams",
      "Sensitive concerns routed to HR, not the line manager",
      "eNPS and Colleague Pulse in one view",
    ]),
    industriesEyebrow: "Solutions",
    industriesHeadline: "The sectors where customer experience carries the most operational weight.",
    finalCtaHeadline: "See how it would run in your organisation.",
    finalCtaSubhead: FINAL_CTA_SUB,
  },
  pricing: {
    pricingEyebrow: "Pricing",
    heroHeadline: "Pricing for each product, or for both.",
    heroSubhead:
      "Customer X and Colleague X are priced and billed separately, so an organisation pays only for what it runs. Every plan includes AI Insights reporting and unlimited responses.",
    metaDescription:
      "OodelCX pricing for Customer X and Colleague X, for single locations and multi-branch groups. Every plan includes AI Insights reporting, Case Management and unlimited responses.",
    loopStripHeadline: "Every plan covers the full framework.",
    loopStripItems: j([
      { label: "Capture", body: "Unlimited feedback points (QR or link) and responses" },
      { label: "Clarify", body: "Themes and root causes identified automatically" },
      { label: "Claim", body: "Case Management with named owners" },
      { label: "Close", body: "Decision Log, Closing the Loop and Playbooks" },
      { label: "Confirm", body: "A maturity score on every plan" },
    ]),
    cePlansSubhead:
      "Organisations already running Customer X can add Colleague X to the same account, with one login and one reporting pipeline.",
    enterpriseNote: "Planning a rollout across a school trust, healthcare group or retail network? We can scope it with you.",
    enterpriseLinkLabel: "Discuss volume pricing →",
  },
  "customer-x": {
    heroHeadline: "Customer feedback, managed from first response to measured outcome.",
    heroSubheadline:
      "Customer X gives an organisation the structure to run customer experience as an ongoing function: feedback collected at each location, issues assigned and resolved, and results measured over time. For colleague feedback, see Colleague X.",
    metaDescription:
      "Customer X from OodelCX: collect customer feedback by QR code or link, assign ownership with Case Management, and measure improvement with CX Pulse.",
    heroChips: j(["No app, no login", "Named owners", "Measured outcomes"]),
    ...CX_VIZ,
    alwaysOnText: "Roles, permissions and two-factor authentication on every plan",
    industriesHeadline: "Used in the sectors where service quality matters.",
    features: withStage(CX_FEATURES),
    finalCtaHeadline: "See the full process in operation.",
    finalCtaSubhead: FINAL_CTA_SUB,
  },
  "colleague-x": {
    heroHeadline: "Colleague experience, managed with the same discipline.",
    heroSubheadline:
      "Colleagues often see a failing process, an unworkable rota or a management problem well before it appears as turnover. Colleague X gives that feedback the same path from first response to resolution as customer feedback, including a route that does not pass through the line manager when the concern requires it.",
    metaDescription:
      "Colleague X from OodelCX: internal feedback collected by QR code or link, with routing of sensitive concerns to HR, Case Management and eNPS.",
    alwaysOnText: "Anonymity controls, roles and two-factor authentication on every plan",
    ...EX_VIZ,
    industriesHeadline: "Used in the sectors where retention and morale matter.",
    features: withStage(EX_FEATURES),
    finalCtaHeadline: "See Colleague X in operation.",
    finalCtaSubhead: FINAL_CTA_SUB,
  },
  solutions: {
    heroHeadline: "Customer experience in the sectors where it carries the most weight.",
    heroBody:
      "The pressures differ by sector, but the need is the same: feedback that has an owner, a record and a measurable result. These pages show how that applies in eight sectors, for customer feedback and for colleague feedback.",
    metaDescription:
      "How OodelCX applies to banking, education, retail, healthcare, telecom, airlines, non-profits and automotive, for customer feedback and colleague feedback.",
    otherHeadline: "Same framework, different context.",
    challengeLabel: "The challenge",
    measuresLabel: "What you can measure",
    usesLabel: "How OodelCX helps",
    measuresNote: "Categories are set when the survey is built, so each organisation chooses its own.",
    industryDetails: j(SOLUTION_INDUSTRIES),
    finalCtaHeadline: "Tell us how your organisation is structured.",
    finalCtaSubhead: "We will show how it maps onto the way you work.",
  },
  company: {
    heroEyebrow: "Company",
    heroSecondaryButton: "See solutions by sector",
    heroSecondaryHref: "/solutions",
    funcTitle: "What an organisational function has",
    funcColumns: j(["Finance or HR", "Customer experience, often", "With OodelCX"]),
    funcRows: j([
      { label: "Owner", cells: ["A named lead", "Shared across several teams", "A named owner for every issue"] },
      { label: "Process", cells: ["A defined cycle", "Varies by team and site", "The 5C Framework at every location"] },
      { label: "Reporting", cells: ["Regular, comparable reports", "Survey results, compiled when time allows", "Scheduled AI Insights reports and exports"] },
      { label: "Evidence", cells: ["A record of decisions", "Scores, with little record of what changed", "A Decision Log with before and after results"] },
    ]),
    trustEyebrow: "How the platform handles responsibility",
    trustHeadline: "Built to be used carefully.",
    trustIntro: "These describe how the product behaves today.",
    trustItems: j([
      { title: "Small groups stay anonymous", body: "Colleague results are never shown for a group of fewer than five responses, so no individual can be picked out." },
      { title: "AI stays within the evidence", body: "Investigations are written only from figures the platform has computed, and each conclusion is labelled likely, inferred or uncertain." },
      { title: "A person reviews reports", body: "AI Insights reports are reviewed before they are published to an account." },
      { title: "Access is controlled", body: "Per-person permissions limit what each team member can open, two-factor authentication protects every login, and sensitive account changes are recorded in an audit log." },
    ]),
    heroHeadline: "Customer experience deserves the same structure as any other function.",
    heroHighlight: "the same structure as any other function.",
    metaDescription:
      "OodelCX exists to give customer and colleague experience the ownership, process and measurement that other organisational functions already have.",
    missionStatement:
      "Finance has ledgers and controls. HR has policies and records. In many organisations, customer experience has a survey and a report. OodelCX provides the missing structure: a named owner for each issue, a defined process for resolving it, and a measure of whether the resolution worked.",
    storyHeadline: "Why OodelCX exists",
    storyParagraphs: j([
      "Most organisations can collect feedback. Far fewer have an agreed process for what happens next: who is responsible for an issue, by when it should be resolved, who is told, and how anyone would know afterwards that it made a difference.",
      "Where that process is missing, feedback is held in survey tools, inboxes and spreadsheets. Patterns are noticed late, responsibility is unclear, and the decisions that followed are rarely recorded, so they are difficult to evaluate or repeat.",
      "OodelCX is built to supply that process, for both sides of an organisation. Every score on the dashboard traces to a case with an owner, and every case traces to a decision whose effect can be measured, for the customers an organisation serves and for the colleagues who serve them.",
    ]),
    beliefsHeadline: "The principles we build to",
    beliefs: j([
      {
        icon: "loop",
        title: "A score is the start of the work",
        body: "A metric that moves without an explanation does not help anyone decide. Every metric in OodelCX links to the cases that are meant to improve it.",
      },
      {
        icon: "scale",
        title: "One product at every scale",
        body: "A single café and a national network run on the same platform. The difference between them is handled in permissions and structure, not in a separate product.",
      },
      {
        icon: "check",
        title: "A person reviews AI output",
        body: "AI-generated insight reports are checked by a person before an account sees them. AI is used to draft the pattern analysis, and people make the decisions.",
      },
      {
        icon: "signal",
        title: "Direct contact with people who know the product",
        body: "When you write to us, the person who replies understands the product and your question.",
      },
    ]),
    audienceHeadline:
      "Organisations with several locations, where feedback needs to reach the right person in good time.",
    audienceItems: j([
      { slug: "banking", name: "Banking & Finance", body: "Branch networks that need conduct-sensitive complaints routed correctly and recorded." },
      { slug: "education", name: "Education", body: "Multi-campus trusts comparing facilities and communication measures term over term." },
      { slug: "retail", name: "Retail", body: "Store chains that need to see results by location and by shift, not as one average." },
      { slug: "healthcare", name: "Healthcare", body: "Facility networks turning wait-time complaints into tracked, measured improvements." },
    ]),
    demoHeadline: "Twenty minutes, on real workflows.",
    demoBody:
      "Tell us about your organisation and which product interests you. We will walk through the whole process using a scenario close to yours.",
    finalCtaHeadline: "Get in touch.",
    finalCtaSubhead:
      "Questions about the product, a sector or how it would fit your organisation are answered by someone who knows it.",
  },
  contact: {
    heroSubhead:
      "Questions about OodelCX, a demo request or anything else: send a message and a member of the team will reply.",
    metaDescription: "Contact the OodelCX team with questions or to request a demo.",
    successBody: "A member of our team will reply shortly, usually within one business day.",
  },
};
