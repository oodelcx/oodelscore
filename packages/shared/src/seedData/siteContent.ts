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
      { key: "pricing", label: "Pricing", visible: true, order: 2 },
      { key: "company", label: "Company", visible: true, order: 3 },
    ],
    sections: [],
    fields: {
      footerDescription: "Feedback is easy to collect. Acting on it is the hard part.",
      footerProductLinks: JSON.stringify(["How it works", "CX Pulse"]),
      footerSolutionsLinks: JSON.stringify(["Single business", "Multi-location groups", "Enterprise"]),
      footerCompanyLinks: JSON.stringify(["Company", "Pricing", "hello@oodelscore.com"]),
      copyrightText: "© Oodel Score. All rights reserved.",
    },
  },
  {
    page: "home",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "Feedback is easy to collect. Acting on it is the hard part.",
      heroSubheadline:
        "Oodel Score turns every QR scan into tracked, owned work — not another number on a dashboard nobody opens. Built for one location or a thousand.",
      heroPrimaryButton: "Book a demo",
      heroSecondaryButton: "See how it works",
      heroBuiltForLine: "restaurants, retail chains, school trusts, and healthcare groups",
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
          body: "Every AI-written report is reviewed by a person before it publishes.",
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
      heroSubhead: "Every plan includes AI-reviewed insights and unlimited responses.",
      plans: JSON.stringify([
        {
          name: "Business",
          price: "£79",
          priceNote: "per month, one location",
          featured: false,
          cta: "Start free trial",
          features: ["Up to 3 feedback points", "Weekly & monthly AI insights", "Action board & alert rules", "Email support"],
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
            "SSO & custom data retention",
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
      listenHeadline: "Feedback in under a minute, no app required",
      listenBody: "A QR code at the table, till point, or exit. Customers answer on their own phone — no login, no download.",
      actHeadline: "A place for the work to actually happen",
      actBody:
        "Flagged feedback becomes a tracked item with an owner and a due date — not a comment that gets read once and forgotten.",
      measureHeadline: "CX Pulse: the score that tracks whether you're improving",
      measureBody:
        "Five dimensions — awareness, response speed, ownership, culture, and measured outcomes — rolled into one number your whole team can rally around.",
      aiHeadline: "Written for you, checked by a person",
      aiBody:
        "Weekly and monthly reports summarize what changed and why — but nothing reaches your dashboard until a human at Oodel Score has reviewed it.",
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
      singleTitle: "Everything in one view",
      singlePoints: JSON.stringify([
        "Your own feedback points, question set, and alert rules",
        "Weekly and monthly AI-written reports",
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
    page: "company",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "We think feedback tools stopped too early.",
      missionStatement:
        "Most platforms treat \"collect feedback\" as the whole job. We think that's the easy third. Oodel Score exists because the harder, more valuable work — turning what customers say into something a team actually does, and knowing whether it worked — was left to spreadsheets and good intentions. We built the other two thirds.",
      howWeWorkItems: JSON.stringify([
        {
          title: "We review the AI, not just ship it",
          body: "Every automated report is checked by a person before a customer ever sees it.",
        },
        {
          title: "We design for the org chart, not the demo",
          body: "A single café and a thousand-branch retailer both use Oodel Score.",
        },
        {
          title: "We stay small and direct",
          body: "When you email us, a person who understands the product answers.",
        },
      ]),
      contactEmail: "hello@oodelscore.com",
    },
  },
];
