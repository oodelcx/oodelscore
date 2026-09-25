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
      { key: "product", label: "Customer Experience", visible: true, order: 0 },
      { key: "colleague-pulse", label: "Colleague Pulse", visible: true, order: 1 },
      { key: "solutions", label: "Solutions", visible: true, order: 2 },
      { key: "how-it-works", label: "How it works", visible: true, order: 3 },
      { key: "pricing", label: "Pricing", visible: true, order: 4 },
      { key: "company", label: "Company", visible: true, order: 5 },
      { key: "contact", label: "Contact", visible: true, order: 6 },
    ],
    sections: [],
    fields: {
      siteName: "OodelCX",
      footerDescription:
        "One platform, two ways to listen: Customer Experience and Colleague Pulse. Feedback collection, AI Insights, and the tools to actually act on both — for one location or a thousand.",
      footerProductLinks: JSON.stringify(["How it works", "CX Pulse", "Colleague Pulse", "Pricing"]),
      footerSolutionsLinks: JSON.stringify(["Solutions", "The mechanism", "Pricing"]),
      footerCompanyLinks: JSON.stringify(["About", "Contact", "Privacy policy", "Terms"]),
      footerProductHeading: "Customer Experience",
      footerSolutionsHeading: "Solutions",
      footerCompanyHeading: "Company",
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
        "OodelCX turns every QR scan — from a customer or a colleague — into tracked, owned work, not another number on a dashboard nobody opens. Built for one location or a thousand.",
      metaDescription:
        "OodelCX turns customer and colleague feedback into tracked, owned work — QR-code surveys, AI Insights reports, and Case Management built for one location or a thousand.",
      loopHeadline: "Listen. Understand. Act. Measure.",
      loopStages: JSON.stringify([
        { label: "Listen", title: "Collect", body: "A QR scan, a short survey, no app or login." },
        { label: "Understand", title: "Make sense of it", body: "Themes, root causes, and drivers surfaced automatically." },
        { label: "Act", title: "Do something", body: "An owned case in Case Management, not a comment nobody reads." },
        { label: "Measure", title: "Know if it worked", body: "CX Pulse tracks whether the loop is actually closing." },
      ]),
      heroCarouselIntervalSeconds: "3",
      heroPrimaryButton: "Book a demo",
      heroSecondaryButton: "See how it works",
      heroBuiltForLine: "bank branch networks, retail chains, school trusts, and healthcare groups",
      heroTwoProductsHeadline: "Two ways to listen, one platform to act on both.",
      heroTwoProductsBody:
        "Customer Experience and Colleague Pulse run on the exact same engine — QR feedback, AI Insights, Case Management, and a maturity score — pointed at two different audiences. Run one or both.",
      heroTwoProductsCxLabel: "Customer Experience",
      heroTwoProductsCxBody: "What customers, clients, or patients tell you after an interaction.",
      heroTwoProductsCeLabel: "Colleague Pulse",
      heroTwoProductsCeBody: "What your own staff tell you, including what routes straight to HR, not their manager.",
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
          body: "Every AI Insights report is reviewed by a person before it publishes.",
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
      heroHeadline: "Straightforward pricing, for either product — or both.",
      heroSubhead:
        "Customer Experience and Colleague Pulse are priced and billed separately, so you only pay for what you actually run. Every plan includes AI Insights reporting and unlimited responses.",
      metaDescription:
        "OodelCX pricing for Customer Experience and Colleague Pulse — single locations and multi-branch groups, every plan includes AI Insights reporting, Case Management, and unlimited responses.",
      loopStripHeadline: "Every plan is the whole loop, not a slice of it.",
      loopStripItems: JSON.stringify([
        { label: "Listen", body: "Unlimited QR feedback points and responses" },
        { label: "Understand", body: "Themes and root causes surfaced automatically" },
        { label: "Act", body: "Case Management, Decision Log, and Playbooks included" },
        { label: "Measure", body: "A maturity score on every plan tier" },
      ]),
      cxPlansHeading: "Customer Experience",
      cePlansHeading: "Colleague Pulse",
      cePlansSubhead:
        "Already running Customer Experience? Adding Colleague Pulse is a second line item on the same account — one login, one AI Insights pipeline, no new dashboard to learn.",
      plans: JSON.stringify([
        {
          product: "customer_experience",
          name: "Business",
          price: "£79",
          priceNote: "per month, one location",
          featured: false,
          cta: "Start free trial",
          features: ["Up to 3 feedback points", "Weekly & monthly AI Insights reports", "Action board & alert rules", "Email support"],
        },
        {
          product: "customer_experience",
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
          product: "customer_experience",
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
        {
          product: "colleague_experience",
          name: "Team",
          price: "£49",
          priceNote: "per month, one location",
          featured: false,
          cta: "Start free trial",
          features: [
            "Unlimited colleague roster",
            "Sensitive-category routing straight to HR",
            "eNPS tracked alongside Colleague Pulse",
            "Email support",
          ],
        },
        {
          product: "colleague_experience",
          name: "Network",
          price: "From £179",
          priceNote: "per month, per branch billing available",
          featured: true,
          cta: "Book a demo",
          features: [
            "Unlimited branches",
            "Colleague Pulse compared branch to branch",
            "CX ↔ EX Correlation, if you also run Customer Experience",
            "Shared playbooks & decision log",
            "Per-branch or group-wide billing",
          ],
        },
        {
          product: "colleague_experience",
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
      enterpriseNote: "Onboarding a school trust, healthcare group, or retail chain — for either product, or both?",
    },
  },
  {
    page: "product",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "Customer Experience: everything from a QR scan to a resolved decision.",
      heroSubheadline:
        "The whole loop for feedback from customers, clients, or patients — collecting it, turning it into owned work, and proving whether that work is actually changing anything. Listening to your own staff instead? See Colleague Pulse.",
      metaDescription:
        "See how OodelCX's Customer Experience product collects feedback, turns it into owned work with Case Management, and measures real improvement with CX Pulse.",
      features: JSON.stringify([
        {
          tag: "Feedback Collection",
          menuFeatured: true,
          group: "understand",
          headline: "Feedback the moment it happens, not a survey nobody opens",
          body: "A QR code or a link, placed exactly where the interaction happened. No app, no login — a customer answers on their own phone in under a minute, and it's in your dashboard before they've left.",
        },
        {
          tag: "CX Pulse",
          menuFeatured: true,
          group: "understand",
          headline: "The score that tracks whether you're improving",
          body: "Five dimensions — awareness, response speed, ownership, culture, and measured outcomes — rolled into one number your whole team can rally around. Not a satisfaction score. A measure of whether feedback is actually shaping decisions.",
        },
        {
          tag: "Theme Intelligence",
          menuFeatured: true,
          group: "understand",
          headline: "What customers keep bringing up, without reading every comment",
          body: "Open-text responses are grouped into recurring themes automatically, so a spike in \"wait time\" complaints surfaces the moment it starts, instead of three weeks and forty comments later.",
        },
        {
          tag: "Root Cause Investigation",
          group: "understand",
          headline: "Not just what's wrong — why",
          body: "Related flagged responses are traced back to a shared cause across shifts, branches, or time periods, so the fix targets the actual problem instead of the loudest symptom.",
        },
        {
          tag: "Driver Analysis",
          group: "understand",
          headline: "The categories actually moving your score",
          body: "See which rated categories correlate most with overall satisfaction and NPS, so effort goes where it changes the number — not just wherever feedback happens to be loudest.",
        },
        {
          tag: "Branch & Session Comparison",
          group: "understand",
          headline: "See which branch, shift, or session is actually different",
          body: "Compare feedback across branches, or — for training and events — across individual sessions and facilitators, so you know exactly where performance diverges instead of one blended average hiding it.",
        },
        {
          tag: "Trend Benchmarking",
          group: "understand",
          headline: "Better than last month, or just louder this month?",
          body: "Every score is shown against its own history — this week versus last, this quarter versus the one before — so a change in the number means something, not just noise from a slow week.",
        },
        {
          tag: "AI Insights Reports",
          menuFeatured: true,
          group: "understand",
          headline: "A plain-English summary, on a schedule, without anyone writing it",
          body: "Weekly, monthly, and quarterly reports are generated automatically from your real numbers — grounded only in what the data actually shows, and reviewed before anyone outside your team sees it.",
        },
        {
          tag: "Case Management",
          menuFeatured: true,
          group: "act",
          headline: "A place for the work to actually happen",
          body: "Flagged feedback becomes a tracked case with an owner and a due date — not a comment that gets read once and forgotten.",
        },
        {
          tag: "Automatic Alerts",
          menuFeatured: true,
          group: "act",
          headline: "Know the moment something needs attention",
          body: "Set a threshold — a score drop, a sudden dip, an outlier branch — and the right person is notified the moment it's crossed, instead of finding out at the end of the month.",
        },
        {
          tag: "Guided Playbooks",
          menuFeatured: true,
          group: "act",
          headline: "The next step, already written down",
          body: "A repeat problem doesn't need a meeting to decide what to do about it — a Playbook attaches automatically with the exact steps your team already agreed on, checked off as they happen.",
        },
        {
          tag: "Decision Log",
          menuFeatured: true,
          group: "act",
          headline: "Did the change actually work?",
          body: "Bigger changes get logged with the trigger that caused them and a measured before/after outcome — so \"we fixed it\" is something you can prove, not just claim.",
        },
        {
          tag: "Escalation Workflows",
          group: "act",
          headline: "Nothing sits untouched because no one owns it",
          body: "A case with no movement doesn't quietly age out — it escalates up a chain you define, so the person who can actually act on it knows before it becomes a bigger problem.",
        },
        {
          tag: "Downloadable Reports",
          group: "act",
          headline: "The numbers, ready for the meeting that needs them",
          body: "Export a clean, presentation-ready report for any period — for a board meeting, a franchise review, or your own records — without rebuilding a spreadsheet from scratch.",
        },
        {
          tag: "Roles, Permissions & Security",
          group: "act",
          headline: "The right access, for the right person, nothing more",
          body: "Custom roles mean a shift lead sees their own cases, a CFO sees billing, and a regional manager sees their region — all with two-factor authentication protecting every login.",
        },
      ]),
    },
  },
  {
    page: "colleague-pulse",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "Colleague Pulse: the same rigor, pointed at your own team.",
      heroSubheadline:
        "Staff hear about a broken process, a bad rota, or a manager problem long before it shows up as a resignation letter. Colleague Pulse gives that feedback the same QR-to-case pipeline as your customers get — including a route that bypasses the manager entirely when it needs to.",
      metaDescription:
        "Colleague Pulse: internal feedback for staff, built on the same engine as OodelCX's Customer Experience product — QR surveys, AI Insights, sensitive-category routing to HR, Case Management, and eNPS.",
      features: JSON.stringify([
        {
          tag: "Colleague Feedback Collection",
          menuFeatured: true,
          group: "understand",
          headline: "A QR code your team actually uses, not an annual survey they dread",
          body: "The same short, no-login survey your customers get — at a break room, on a shift-change screen, or sent as a link — so a rota complaint or a safety concern reaches you the week it happens, not in next year's engagement survey.",
        },
        {
          tag: "Colleague Pulse Score",
          menuFeatured: true,
          group: "understand",
          headline: "One number for whether staff feedback actually changes anything",
          body: "The same five-dimension maturity framework as Customer Experience's CX Pulse — awareness, response speed, ownership, culture, measured outcomes — rebuilt around colleague listening instead of customer listening.",
        },
        {
          tag: "eNPS",
          menuFeatured: true,
          group: "understand",
          headline: "The one number leadership already asks for",
          body: "Employee Net Promoter Score, tracked alongside Colleague Pulse rather than as a separate spreadsheet someone assembles once a quarter — so \"would you recommend working here\" has a trend line, not just a snapshot.",
        },
        {
          tag: "Sensitive-Category Routing",
          menuFeatured: true,
          group: "understand",
          headline: "A complaint about a manager never lands on that manager's desk",
          body: "Categories marked sensitive — HR complaints, leadership concerns, harassment — bypass your normal owner routing entirely and go straight to a designated contact, so a colleague reporting a problem with their own manager isn't handing it to the person it's about.",
        },
        {
          tag: "Colleague Roster",
          group: "understand",
          headline: "Feedback tied to a real team, not an anonymous pool",
          body: "Keep a roster of who's being asked, by location and role, so response patterns can be read at the level that's actually useful — this shift, this branch, this department — without losing the option to keep individual responses anonymous.",
        },
        {
          tag: "CX ↔ EX Correlation",
          menuFeatured: true,
          group: "understand",
          headline: "Prove the thing everyone already suspects",
          body: "Run both products, and see whether a dip in colleague sentiment at a branch actually predicts a dip in customer sentiment a few weeks later — a cross-product view no single-product feedback tool can show you.",
        },
        {
          tag: "Theme Intelligence",
          group: "understand",
          headline: "What your team keeps bringing up, without reading every comment",
          body: "Recurring themes in open-text answers — understaffing, a specific piece of equipment, a scheduling pattern — surface automatically, the same as they do for customer feedback.",
        },
        {
          tag: "AI Insights Reports",
          group: "understand",
          headline: "A plain-English summary of colleague sentiment, on a schedule",
          body: "Weekly, monthly, and quarterly reports generated from real responses, reviewed by a person before anyone outside HR or leadership sees them.",
        },
        {
          tag: "Case Management",
          menuFeatured: true,
          group: "act",
          headline: "A flagged concern becomes an owned case, not a comment in a survey tool",
          body: "The same Case Management your Customer Experience side uses — an owner, a due date, a status — so a colleague concern gets tracked to resolution instead of read once and filed.",
        },
        {
          tag: "Guided Playbooks",
          group: "act",
          headline: "The next step, already agreed on",
          body: "A recurring issue — the same equipment complaint, the same scheduling gripe — attaches a Playbook with the steps your team already decided on, instead of relitigating the response every time.",
        },
        {
          tag: "Decision Log",
          group: "act",
          headline: "Did the fix actually move the number?",
          body: "Log the change, the trigger that caused it, and a measured before/after — so a rota change or a new onboarding process is something you can show worked, not just something you rolled out.",
        },
        {
          tag: "Automatic Alerts",
          group: "act",
          headline: "Know the moment something needs attention",
          body: "A Colleague Pulse dip, a sudden eNPS drop, or an outlier branch triggers an alert to the right person immediately — same mechanism as Customer Experience's alert rules.",
        },
      ]),
    },
  },
  {
    page: "solutions",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "Built for how your organization actually works — and who it's actually listening to.",
      heroBody:
        "Single location, growing chain, or thousand-branch network. Customer feedback, colleague feedback, or both. The same clarity, without forcing every business — or every audience — to look identical.",
      metaDescription:
        "OodelCX for single businesses, multi-location groups, and enterprise networks — regional benchmarking, per-branch billing, and custom roles, for Customer Experience and Colleague Pulse alike.",
      singleTitle: "Everything in one view",
      singlePoints: JSON.stringify([
        "Your own feedback points, question set, and alert rules",
        "Weekly and monthly AI Insights reports",
        "Your own Case Management, Decision Log, and Playbooks",
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
      industriesTitle: "Built for the businesses that already run on it",
      industriesBody: "The same platform, configured to how each industry actually collects and acts on feedback.",
      // Structured per-industry content, not just names — each one gets its
      // own page at /solutions/[slug] (see app/(marketing)/solutions/[slug]).
      // "industries" (the old plain-string-array field) is intentionally
      // gone: the chip grid and the mega-menu's "By Industry" column both
      // now read from this instead, so there's exactly one place an admin
      // edits an industry's name or copy, never two lists to keep in sync.
      industryDetails: JSON.stringify([
        {
          slug: "banking",
          locationNoun: "branch",
          name: "Banking & Finance",
          tagline: "A compliance complaint should never land on the desk of the person it's about.",
          heroBody:
            "A wait-time gripe and a mis-sold-product complaint look identical in a spreadsheet of star ratings. They are not identical, and routing them the same way is how a real problem sits for a month disguised as a bad Tuesday. OodelCX reads what a complaint actually is before it decides who sees it.",
          standaloneBody:
            "One branch, one QR code at the counter or in the app. A complaint about a fee explanation, a wait, or a specific member of staff becomes a case with an owner and a due date the same day — not a line in an inbox someone gets to eventually.",
          groupBody:
            "A regional or national network sees every branch on one screen: which one is quietly bleeding customers to wait times, which one's sensitive complaints are correctly reaching compliance instead of a teller's own line manager, and which fix — a queue change, a script update — is worth rolling out everywhere instead of reinventing at the next branch that hits the same problem.",
          benefits: [
            "Compliance- and conduct-sensitive complaints route straight to a designated contact — never to the person, or the branch, they're about",
            "Branch-vs-branch benchmarking on wait time and service scores, not one blended network NPS hiding which locations actually need help",
            "A flagged interaction becomes an owned case the same day, with a due date a regional manager can actually chase",
            "A real before/after on the exact metric a branch was struggling with — for the audit trail, not just the team meeting",
          ],
        },
        {
          slug: "education",
          locationNoun: "campus",
          name: "Education",
          tagline: "Parents raise it at pickup. Staff never raise it at all. Now both have somewhere to put it.",
          heroBody:
            "A school hears from parents constantly — at the gate, in the WhatsApp group, in a strongly worded email to the office — and from its own staff almost never, because there's no route that doesn't feel like going over someone's head. OodelCX gives both a QR code, and gives the staff route a way to skip straight to a trustee or HR lead when it needs to.",
          standaloneBody:
            "One campus, one front office. A facilities complaint, a communication gap, or a small thing that's quietly eroding parent trust becomes a tracked case instead of a hallway conversation nobody wrote down and nobody followed up on.",
          groupBody:
            "A multi-campus trust compares every school side by side: which campus's facilities complaints keep recurring term after term, which one's front-office communication scores are actually dragging the trust average down, and where a fix that worked at one site is overdue everywhere else.",
          benefits: [
            "Facilities and communication issues become owned cases with a due date, not a hallway conversation that goes nowhere",
            "Campus-vs-campus comparison across a trust, so a fix that worked at one school gets rolled out, not reinvented",
            "The same complaint at the same campus three times in a term gets flagged as a pattern automatically, not noticed by chance",
            "Staff feedback stays completely separate from family-facing surveys, with its own route past a direct manager when needed",
          ],
        },
        {
          slug: "retail",
          locationNoun: "store",
          name: "Retail",
          tagline: "A dip in your average tells you nothing. This tells you which store, which shift.",
          heroBody:
            "\"Our rating dropped this month\" is not an action. \"Store 14's Saturday afternoon shift dropped\" is. OodelCX gives the store manager a case with a due date instead of giving head office a number to shrug at in a review deck.",
          standaloneBody:
            "One store, one QR code at checkout or on the receipt. A stockout complaint, a slow line, a rude interaction — each becomes a case with an owner, so the next shift lead isn't starting the day guessing what actually needs fixing.",
          groupBody:
            "A multi-store chain compares every location and every shift pattern side by side, spots the store quietly dragging the network average down before quarter-end forces the question, and shares one playbook across the chain instead of every store manager solving the same problem alone.",
          benefits: [
            "Store-vs-store and shift-pattern comparison, not one blended average that hides which location actually needs help",
            "Three stockout mentions in two weeks at one store gets flagged as a pattern before it becomes next quarter's surprise",
            "A guided playbook turns a repeat issue into a standard response the whole chain reuses instead of relearning",
            "A clean, exportable report for the regional or ops review — no store manager needs to remember another login",
          ],
        },
        {
          slug: "healthcare",
          locationNoun: "facility",
          name: "Healthcare",
          tagline: "A two-hour wait is a case for clinical ops, not a line in a patient satisfaction PDF.",
          heroBody:
            "Patients tell you about the wait, the check-in process, the way a result got explained — and on paper-based feedback, almost none of it reaches anyone who can actually change how the day runs. OodelCX turns a flagged visit into a case a clinical operations manager can close, and routes anything sensitive around the clinician it concerns.",
          standaloneBody:
            "One clinic or facility, one QR code at check-in or discharge. A wait-time or communication complaint becomes an owned case the same day — not a comment card in a box that gets emptied once a month, if at all.",
          groupBody:
            "A multi-facility network compares wait times and patient-experience scores across every site, spots the facility whose numbers are sliding before it becomes a review-board question, and rolls out the fix — a real-time wait tracker, a staffing change to a specific shift — everywhere it's actually needed, not just where someone happened to notice.",
          benefits: [
            "Wait-time and check-in complaints become owned cases with a due date, not a form in a box",
            "Facility-vs-facility benchmarking on the metrics that actually drive patient trust, not a single blended satisfaction score",
            "A recurring wait-time pattern at one facility gets flagged and turned into a tracked improvement initiative automatically",
            "A measured before/after for the fix, ready for the review board that will ask whether it actually worked",
          ],
        },
      ]),
    },
  },
  {
    page: "how-it-works",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "From a QR scan to a measured result — the actual sequence.",
      heroBody:
        "Not a feature list. This is the path a single piece of feedback actually takes through OodelCX, start to finish.",
      metaDescription:
        "The step-by-step mechanism behind OodelCX — from a QR code scan through AI Insights tagging, alerts, the Case Management, the Decision Log, and CX Pulse.",
      steps: JSON.stringify([
        {
          title: "A QR code goes up at the point of service",
          body: "A till, a table, a service counter, a branch exit — the feedback point is placed where the interaction actually happened, not emailed out later when the moment has passed.",
        },
        {
          title: "A customer scans it and answers a short survey",
          body: "No app to install, no account to create. Star ratings, NPS, and open comments on the customer's own phone, answered in under a minute.",
        },
        {
          title: "The response lands in the dashboard, already tagged",
          body: "AI Insights reads the response as it arrives — sentiment, and which recurring theme it belongs to (via Theme Intelligence) — so nothing sits in a raw, unread queue.",
        },
        {
          title: "Alert rules flag what actually needs attention",
          body: "A low score, a flagged theme, or a pattern crossing a threshold triggers an alert to the right person — instead of every response getting equal, unfiltered attention.",
        },
        {
          title: "Case Management turns it into an owned task",
          body: "A flagged response becomes a tracked case with an owner and a due date. Recurring issues can be handled with a Playbook, so the same fix doesn't get reinvented every time.",
        },
        {
          title: "The Decision Log measures whether the fix worked",
          body: "Bigger changes get logged with the trigger that caused them and a before/after outcome — so \"we fixed it\" is something you can prove, not just claim.",
        },
        {
          title: "CX Pulse tracks the whole cycle's maturity over time",
          body: "Not just today's score — whether the organization is actually getting better at closing the loop: awareness, response speed, ownership, culture, and measured outcomes.",
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
      // Must be an exact substring of heroHeadline — same convention as the
      // login page's heroHighlight — the portion shown in italic accent
      // green. Kept independently editable so a future headline edit
      // doesn't silently break the accent (the Admin panel warns if it
      // stops matching).
      heroHighlight: "too early.",
      metaDescription:
        "OodelCX exists to turn customer feedback into action, not just a dashboard number. Learn what we build and why.",
      missionStatement:
        "Most platforms treat \"collect feedback\" as the whole job. We think that's the easy third. OodelCX exists because the harder, more valuable work — turning what customers say into something a team actually does, and knowing whether it worked — was left to spreadsheets and good intentions. We built the other two thirds.",
      howWeWorkItems: JSON.stringify([
        {
          title: "We review AI Insights, not just ship it",
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
    page: "contact",
    navItems: [],
    sections: [],
    fields: {
      heroHeadline: "Get in touch.",
      heroSubhead:
        "Questions about OodelCX, a demo request, or something else entirely — send us a message and a person will get back to you.",
      metaDescription:
        "Contact the OodelCX team — questions, demo requests, or anything else. Send a message and a person will get back to you.",
      successHeadline: "Thanks — we'll be in touch.",
      successBody: "Someone from our team will reply soon, usually within a business day.",
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
          text: "Account data is used to operate your dashboard, generate AI Insights reports, and send the account-side emails described in your Email Templates. Feedback response data belongs to the business or organization that collected it.",
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
      metaDescription: "The terms governing use of the OodelCX platform, billing, and AI Insights content.",
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
          heading: "AI Insights content",
          text: "Insights reports are AI-drafted and reviewed by a person before publication, but OodelCX does not guarantee the accuracy of AI Insights summaries.",
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
