import type { SiteContentPage, INavItem, ISiteSection } from "../models/SiteContent";

interface SeedSiteContent {
  page: SiteContentPage;
  navItems: INavItem[];
  sections: ISiteSection[];
  fields: Record<string, string>;
}

// Default copy ported directly from oodel-score-marketing-site.html. List-shaped
// content (nav steps, plan feature lists, "why" items, etc.) that the model
// can't represent structurally is stored as JSON-encoded strings inside
// `fields` — the CMS UI parses/re-serializes it, the marketing site does the
// same. Final wording is edited from Admin -> Site Content, not here.
export const SEED_SITE_CONTENT: SeedSiteContent[] = [
  {
    page: "menu",
    navItems: [
      { key: "product", label: "Product", visible: true, order: 0 },
      { key: "solutions", label: "Solutions", visible: true, order: 1 },
      { key: "industries", label: "Industries", visible: true, order: 2 },
      { key: "pricing", label: "Pricing", visible: true, order: 3 },
      { key: "company", label: "Company", visible: true, order: 4 },
    ],
    sections: [],
    fields: {
      siteName: "OodelCX",
      footerDescription:
        "Feedback collection, OCX Intelligence reports, and the tools to actually act on both — for one location or a thousand.",
      footerProductLinks: JSON.stringify(["How it works", "CX Pulse", "Pricing"]),
      footerSolutionsLinks: JSON.stringify(["Solutions", "Industries", "Pricing"]),
      footerCompanyLinks: JSON.stringify(["About", "Privacy policy", "Terms"]),
      copyrightText: "© OodelCX. All rights reserved.",
    },
  },
  {
    page: "home",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "Feedback is easy to collect. Acting on it is the hard part.",
      heroSubheadline:
        "OodelCX turns every QR scan into tracked, owned work — not another number on a dashboard nobody opens. Built for one location or a thousand.",
      metaDescription:
        "OodelCX turns customer feedback into tracked, owned work — QR-code surveys, OCX Intelligence reports, and an Action Board built for one location or a thousand.",
      loopHeadline: "Listen. Understand. Act. Measure.",
      loopStages: JSON.stringify([
        { label: "Listen", title: "Collect", body: "A QR scan, a short survey, no app or login." },
        { label: "Understand", title: "Make sense of it", body: "Themes, root causes, and drivers surfaced automatically." },
        { label: "Act", title: "Do something", body: "An owned task on the Action Board, not a comment nobody reads." },
        { label: "Measure", title: "Know if it worked", body: "CX Pulse tracks whether the loop is actually closing." },
      ]),
      heroCarouselIntervalSeconds: "3",
      heroPrimaryButton: "Book a demo",
      heroSecondaryButton: "See how it works",
      heroBuiltForLine: "bank branch networks, retail chains, school trusts, and healthcare groups",
      narrativeHeadline: "Most tools stop at collecting. We built the other two thirds.",
      narrativeSubhead: "A score with nowhere to go is just a number.",
      narrativeSteps: JSON.stringify([
        {
          label: "Listen",
          title: "Collect feedback in under a minute",
          body: "A QR code, a short mobile survey, no app or login. Star ratings, NPS, and open comments arrive instantly in one dashboard.",
        },
        {
          label: "Act",
          title: "Turn a complaint into an owned task",
          body: "Flagged feedback becomes a tracked item with an owner and a due date. Bigger patterns become logged decisions with a measured outcome.",
        },
        {
          label: "Measure",
          title: "Know if it's actually working",
          body: "CX Pulse scores whether your team is closing the loop — not just whether customers are happy, but whether that's changing anything.",
        },
      ]),
      scaleHeadline: "One location or a thousand — same clarity.",
      scaleSubhead: "The dashboard scales with you, without becoming a different product.",
      scalePanel1Tag: "Single business",
      scalePanel2Tag: "Multi-location groups",
      cxPulseHeadline: "Are you improving, or just watching a number?",
      cxPulseLevels: JSON.stringify([
        { level: "1", name: "Collecting", desc: "Gathering feedback, no consistent follow-up" },
        { level: "2", name: "Reacting", desc: "Occasional responses, no clear ownership" },
        { level: "3", name: "Responding", desc: "Most flagged feedback gets a timely reply" },
        { level: "4", name: "Improving", desc: "Feedback drives visible operational change" },
        { level: "5", name: "Embedded", desc: "Outcomes are measured, culture is customer-led" },
      ]),
      whyItems: JSON.stringify([
        {
          title: "Nothing reaches a dashboard unchecked",
          body: "Every OCX Intelligence report is reviewed by a person before it publishes.",
        },
        {
          title: "Built for the org chart you actually have",
          body: "Role-based access and per-branch billing control that doesn't force every location to look identical.",
        },
        {
          title: "A QR code, not a project",
          body: "No app to install, no account for your customers to create.",
        },
      ]),
    },
  },
  {
    page: "pricing",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "Straightforward pricing, whatever your size.",
      heroSubhead: "Every plan includes OCX Intelligence reporting and unlimited responses.",
      metaDescription:
        "OodelCX pricing for single locations and multi-branch groups — every plan includes OCX Intelligence reporting, an Action Board, and unlimited responses.",
      loopStripHeadline: "Every plan is the whole loop, not a slice of it.",
      loopStripItems: JSON.stringify([
        { label: "Listen", body: "Unlimited QR feedback points and responses" },
        { label: "Understand", body: "Themes and root causes surfaced automatically" },
        { label: "Act", body: "Action Board, Decision Log, and Playbooks included" },
        { label: "Measure", body: "CX Pulse scoring on every plan tier" },
      ]),
      plans: JSON.stringify([
        {
          name: "Business",
          price: "£79",
          priceNote: "per month, one location",
          featured: false,
          cta: "Start free trial",
          features: ["Up to 3 feedback points", "Weekly & monthly OCX Intelligence reports", "Action board & alert rules", "Email support"],
        },
        {
          name: "Group",
          price: "From £249",
          priceNote: "per month, per branch billing available",
          featured: true,
          cta: "Book a demo",
          features: [
            "Unlimited branches",
            "Regional comparison & benchmarking",
            "Shared playbooks & decision log",
            "Per-branch or group-wide billing",
            "CX Pulse across every branch",
          ],
        },
        {
          name: "Enterprise",
          price: "Custom",
          priceNote: "for networks of 100+ branches",
          featured: false,
          cta: "Talk to sales",
          features: [
            "Dedicated account manager",
            "Custom roles & permissions",
            "Quarterly business reviews",
          ],
        },
      ]),
      enterpriseNote: "Onboarding a school trust, healthcare group, or retail chain?",
    },
  },
  {
    page: "product",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "Everything from a QR scan to a resolved decision.",
      heroSubheadline:
        "One platform for the whole loop — collecting feedback, turning it into owned work, and proving whether that work is actually changing anything.",
      metaDescription:
        "See how OodelCX collects feedback, turns it into owned work with the Action Board, and measures real improvement with CX Pulse.",
      features: JSON.stringify([
        {
          tag: "CX Pulse",
          headline: "The score that tracks whether you're improving",
          body: "Five dimensions — awareness, response speed, ownership, culture, and measured outcomes — rolled into one number your whole team can rally around. Not a satisfaction score. A measure of whether feedback is actually shaping decisions.",
        },
        {
          tag: "Theme Intelligence",
          headline: "What customers keep bringing up, without reading every comment",
          body: "Open-text responses are grouped into recurring themes automatically, so a spike in \"wait time\" complaints surfaces the moment it starts, instead of three weeks and forty comments later.",
        },
        {
          tag: "Root Cause Analysis",
          headline: "Not just what's wrong — why",
          body: "Related flagged responses are traced back to a shared cause across shifts, branches, or time periods, so the fix targets the actual problem instead of the loudest symptom.",
        },
        {
          tag: "Driver Analysis",
          headline: "The categories actually moving your score",
          body: "See which rated categories correlate most with overall satisfaction and NPS, so effort goes where it changes the number — not just wherever feedback happens to be loudest.",
        },
        {
          tag: "Action Board",
          headline: "A place for the work to actually happen",
          body: "Flagged feedback becomes a tracked item with an owner and a due date — not a comment that gets read once and forgotten.",
        },
        {
          tag: "Decision Log",
          headline: "Did the change actually work?",
          body: "Bigger changes get logged with the trigger that caused them and a measured before/after outcome — so \"we fixed it\" is something you can prove, not just claim.",
        },
      ]),
    },
  },
  {
    page: "solutions",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "Built for how your organization actually works.",
      heroBody:
        "Single location, growing chain, or thousand-branch network — the same clarity, without forcing every business to look identical.",
      metaDescription:
        "OodelCX for single businesses, multi-location groups, and enterprise networks — regional benchmarking, per-branch billing, and custom roles.",
      singleTitle: "Everything in one view",
      singlePoints: JSON.stringify([
        "Your own feedback points, question set, and alert rules",
        "Weekly and monthly OCX Intelligence reports",
        "Your own Action Board, Decision Log, and Playbooks",
        "Your own CX Pulse score, tracked over time",
      ]),
      groupTitle: "Compare every branch, act across all of them",
      groupPoints: JSON.stringify([
        "Regional benchmarking — see who's ahead and who needs support",
        "Per-branch billing: your group can pay for some branches, others pay their own way",
        "Per-branch Act ownership — shared, group-managed, or fully local",
      ]),
      entTitle: "Built for the org chart you actually have",
      entPoints: JSON.stringify([
        "Custom roles and permissions — a CFO sees billing, not customer feedback",
        "Dedicated account manager and quarterly business reviews",
      ]),
    },
  },
  {
    page: "industries",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "Built for the sector you actually run.",
      heroBody: "Pick your industry — the pain points and what OodelCX does about them are specific, not generic.",
      metaDescription:
        "How OodelCX applies to banking, education, diagnostics, retail, restaurants, fitness, and automotive — feedback collection, OCX Intelligence, and tracked follow-through by sector.",
      sectors: JSON.stringify([
        {
          key: "banking",
          label: "Banking",
          painPoints: [
            "Branch experience varies widely and head office only hears about the worst cases",
            "Compliance and service-quality feedback get collected in different, disconnected places",
          ],
          outcomes: [
            "Surfaces recurring complaints by branch and by service line",
            "Routes flagged feedback to a branch manager with a due date and an audit trail",
          ],
          stats: [
            { label: "Question types", value: "9" },
            { label: "Branch rollup", value: "Regional" },
          ],
        },
        {
          key: "education",
          label: "Education",
          painPoints: [
            "Parent and student feedback is scattered across emails, forms, and hallway conversations",
            "A school trust with multiple campuses has no shared view of where issues are concentrated",
          ],
          outcomes: [
            "One feedback point per campus, rolled up for the whole trust",
            "Recurring themes (e.g. communication, facilities) tracked over a term, not just a snapshot",
          ],
          stats: [
            { label: "Campuses", value: "Unlimited" },
            { label: "Reporting", value: "Weekly" },
          ],
        },
        {
          key: "diagnostics",
          label: "Diagnostics / Healthcare",
          painPoints: [
            "Wait times and result-communication issues are the most common complaints, but rarely tracked systematically",
            "Multi-site labs and clinics need oversight without slowing down front-line staff",
          ],
          outcomes: [
            "Short, anonymous-by-default surveys that don't add friction to a patient visit",
            "Root Cause Analysis links a wait-time spike to a specific shift or site instead of guessing",
          ],
          stats: [
            { label: "Avg. survey time", value: "<1 min" },
            { label: "Anonymous by default", value: "Yes" },
          ],
        },
        {
          key: "retail",
          label: "Retail",
          painPoints: [
            "Store-level service quality is hard to compare across a chain",
            "Seasonal spikes in complaints get lost in the noise of everyday feedback",
          ],
          outcomes: [
            "Branch-vs-branch comparison so underperforming stores are visible, not buried",
            "Action Board turns a recurring complaint into an owned task for a store manager",
          ],
          stats: [
            { label: "Branch comparison", value: "Live" },
            { label: "Alert rules", value: "Custom" },
          ],
        },
        {
          key: "restaurant",
          label: "Restaurant",
          painPoints: [
            "Table-side feedback is inconsistent — a bad night can go entirely unreported",
            "Front-of-house issues (wait time, order accuracy) repeat without a clear owner",
          ],
          outcomes: [
            "A QR code at the table or till, answered in under a minute on a customer's own phone",
            "Theme Intelligence flags a recurring issue (e.g. \"cold food\") before it becomes a pattern of reviews",
          ],
          stats: [
            { label: "Setup", value: "QR code only" },
            { label: "Question types", value: "9" },
          ],
        },
        {
          key: "fitness",
          label: "Fitness",
          painPoints: [
            "Member churn signals (equipment, cleanliness, class quality) often surface too late to act on",
            "Multi-location gyms and studios lack a shared view of which sites need attention",
          ],
          outcomes: [
            "Driver Analysis shows which categories actually correlate with overall satisfaction",
            "CX Pulse tracks whether a location is improving, not just what today's score is",
          ],
          stats: [
            { label: "Locations", value: "Unlimited" },
            { label: "Scoring", value: "CX Pulse" },
          ],
        },
        {
          key: "automotive",
          label: "Automotive",
          painPoints: [
            "Service-bay and sales-floor feedback are usually tracked separately, if at all",
            "Dealership groups need per-branch accountability without losing group-wide oversight",
          ],
          outcomes: [
            "One dashboard for service and sales feedback across every location",
            "Decision Log measures whether a service-process change actually moved the score",
          ],
          stats: [
            { label: "Departments covered", value: "Service + Sales" },
            { label: "Group rollup", value: "Yes" },
          ],
        },
      ]),
    },
  },
  {
    page: "company",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "We think feedback tools stopped too early.",
      metaDescription:
        "OodelCX exists to turn customer feedback into action, not just a dashboard number. Learn what we build and why.",
      missionStatement:
        "Most platforms treat \"collect feedback\" as the whole job. We think that's the easy third. OodelCX exists because the harder, more valuable work — turning what customers say into something a team actually does, and knowing whether it worked — was left to spreadsheets and good intentions. We built the other two thirds.",
      howWeWorkItems: JSON.stringify([
        {
          title: "We review OCX Intelligence, not just ship it",
          body: "Every automated report is checked by a person before a customer ever sees it.",
        },
        {
          title: "We design for the org chart, not the demo",
          body: "A single café and a thousand-branch retailer both use OodelCX.",
        },
        {
          title: "We stay small and direct",
          body: "When you email us, a person who understands the product answers.",
        },
      ]),
      contactEmail: "hello@oodelscore.com",
    },
  },
  {
    page: "privacy",
    navItems: [],
    sections: [],
    fields: {
      heading: "Privacy Policy",
      lastUpdated: "September 2026",
      metaDescription: "How OodelCX collects, uses, and retains account and customer feedback data.",
      body: JSON.stringify([
        {
          heading: "What we collect",
          text: "We collect account information you provide (name, email, business details) and feedback responses submitted through your feedback points. Respondents filling out a feedback form are never required to identify themselves unless a business chooses to make name/email/phone collection mandatory.",
        },
        {
          heading: "How we use it",
          text: "Account data is used to operate your dashboard, generate OCX Intelligence insights reports, and send the account-side emails described in your Email Templates. Feedback response data belongs to the business or organization that collected it.",
        },
        {
          heading: "Data retention",
          text: "Data is retained for as long as your account is active, per the retention policy attached to your plan tier. You can request deletion at any time by contacting us.",
        },
        {
          heading: "Contact",
          text: "Questions about this policy can be sent to hello@oodelscore.com.",
        },
      ]),
    },
  },
  {
    page: "terms",
    navItems: [],
    sections: [],
    fields: {
      heading: "Terms of Service",
      lastUpdated: "September 2026",
      metaDescription: "The terms governing use of the OodelCX platform, billing, and OCX Intelligence content.",
      body: JSON.stringify([
        {
          heading: "Using OodelCX",
          text: "By creating an account, you agree to use OodelCX only for lawful feedback collection and analysis, and not to attempt to identify respondents who submitted feedback anonymously.",
        },
        {
          heading: "Billing",
          text: "Plans are billed per the pricing shown at signup or agreed with your account manager. Branch and team-seat limits are enforced per your plan tier.",
        },
        {
          heading: "OCX Intelligence content",
          text: "Insights reports are drafted with OCX Intelligence and reviewed by a person before publication, but OodelCX does not guarantee the accuracy of OCX Intelligence summaries.",
        },
        {
          heading: "Contact",
          text: "Questions about these terms can be sent to hello@oodelscore.com.",
        },
      ]),
    },
  },
  {
    page: "login",
    navItems: [],
    sections: [],
    fields: {
      // heroHighlight must be an exact substring of heroHeadline — the
      // login/forgot-password/set-password visual panel renders that
      // substring in the accent green, everything else in white.
      heroHeadline: "Know where you stand. Own where you are going.",
      heroHighlight: "Own where you are going.",
    },
  },
];
