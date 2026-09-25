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
      { key: "product", label: "The Platform", visible: true, order: 0 },
      { key: "solutions", label: "Solutions", visible: true, order: 1 },
      { key: "how-it-works", label: "How it works", visible: true, order: 2 },
      { key: "pricing", label: "Pricing", visible: true, order: 3 },
      { key: "company", label: "Company", visible: true, order: 4 },
      { key: "contact", label: "Contact", visible: true, order: 5 },
    ],
    sections: [],
    fields: {
      siteName: "OodelCX",
      footerDescription:
        "Feedback collection, AI Insights reports, and the tools to actually act on both — for one location or a thousand.",
      footerProductLinks: JSON.stringify(["How it works", "CX Pulse", "Pricing"]),
      footerSolutionsLinks: JSON.stringify(["Solutions", "The mechanism", "Pricing"]),
      footerCompanyLinks: JSON.stringify(["About", "Contact", "Privacy policy", "Terms"]),
      footerProductHeading: "Product",
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
        "OodelCX turns every QR scan into tracked, owned work — not another number on a dashboard nobody opens. Built for one location or a thousand.",
      metaDescription:
        "OodelCX turns customer feedback into tracked, owned work — QR-code surveys, AI Insights reports, and Case Management built for one location or a thousand.",
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
      heroHeadline: "Straightforward pricing, whatever your size.",
      heroSubhead: "Every plan includes AI Insights reporting and unlimited responses.",
      metaDescription:
        "OodelCX pricing for single locations and multi-branch groups — every plan includes AI Insights reporting, Case Management, and unlimited responses.",
      loopStripHeadline: "Every plan is the whole loop, not a slice of it.",
      loopStripItems: JSON.stringify([
        { label: "Listen", body: "Unlimited QR feedback points and responses" },
        { label: "Understand", body: "Themes and root causes surfaced automatically" },
        { label: "Act", body: "Case Management, Decision Log, and Playbooks included" },
        { label: "Measure", body: "CX Pulse scoring on every plan tier" },
      ]),
      plans: JSON.stringify([
        {
          name: "Business",
          price: "£79",
          priceNote: "per month, one location",
          featured: false,
          cta: "Start free trial",
          features: ["Up to 3 feedback points", "Weekly & monthly AI Insights reports", "Action board & alert rules", "Email support"],
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
        "See how OodelCX collects feedback, turns it into owned work with the Case Management, and measures real improvement with CX Pulse.",
      features: JSON.stringify([
        {
          tag: "Feedback Collection",
          group: "understand",
          headline: "Feedback the moment it happens, not a survey nobody opens",
          body: "A QR code or a link, placed exactly where the interaction happened. No app, no login — a customer answers on their own phone in under a minute, and it's in your dashboard before they've left.",
        },
        {
          tag: "CX Pulse",
          group: "understand",
          headline: "The score that tracks whether you're improving",
          body: "Five dimensions — awareness, response speed, ownership, culture, and measured outcomes — rolled into one number your whole team can rally around. Not a satisfaction score. A measure of whether feedback is actually shaping decisions.",
        },
        {
          tag: "Theme Intelligence",
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
          group: "understand",
          headline: "A plain-English summary, on a schedule, without anyone writing it",
          body: "Weekly, monthly, and quarterly reports are generated automatically from your real numbers — grounded only in what the data actually shows, and reviewed before anyone outside your team sees it.",
        },
        {
          tag: "Case Management",
          group: "act",
          headline: "A place for the work to actually happen",
          body: "Flagged feedback becomes a tracked case with an owner and a due date — not a comment that gets read once and forgotten.",
        },
        {
          tag: "Automatic Alerts",
          group: "act",
          headline: "Know the moment something needs attention",
          body: "Set a threshold — a score drop, a sudden dip, an outlier branch — and the right person is notified the moment it's crossed, instead of finding out at the end of the month.",
        },
        {
          tag: "Guided Playbooks",
          group: "act",
          headline: "The next step, already written down",
          body: "A repeat problem doesn't need a meeting to decide what to do about it — a Playbook attaches automatically with the exact steps your team already agreed on, checked off as they happen.",
        },
        {
          tag: "Decision Log",
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
          name: "Banking & Financial Services",
          tagline: "Every branch accountable for the visit, not the survey score.",
          heroBody:
            "A wait-time complaint and a teller-friendliness dip look identical on a spreadsheet. OodelCX tells you which one it actually was, and gives the branch manager a case to close — not a number to explain away at the next regional call.",
          standaloneBody:
            "One branch, one QR code at the counter. Every complaint about a specific visit — the wait, the fee explanation, the teller — becomes a case with an owner and a due date, not a comment that sits in an inbox until someone happens to read it.",
          groupBody:
            "A regional or national branch network sees every location side by side — which branch is quietly losing customers to wait times, which one's compliance-sensitive complaints are actually getting routed to compliance instead of a teller's own manager, and where a fix at one branch is worth rolling out everywhere.",
          benefits: [
            "Compliance-sensitive complaints route to a designated contact, never to the person they're about",
            "Branch-vs-branch benchmarking on wait time and service scores, not just an overall NPS",
            "A flagged interaction becomes an owned case the same day, with a due date a regional manager can actually track",
            "Prove a fix worked — before/after numbers on the exact metric a branch was struggling with",
          ],
        },
        {
          slug: "education",
          locationNoun: "campus",
          name: "Education",
          tagline: "Parents and staff both keep telling you things. Now both go somewhere.",
          heroBody:
            "A school or trust hears from parents at pickup, at parent-teacher conferences, and buried in emails — and from staff, rarely, because there's nowhere for it to go. OodelCX gives both a QR code and a real case that gets worked, not filed.",
          standaloneBody:
            "One campus, one front office. Facilities complaints, communication gaps, and the small things that erode parent trust each become a tracked case instead of a hallway conversation nobody wrote down.",
          groupBody:
            "A multi-campus trust compares every school side by side — which campus's facilities complaints keep recurring, which one's front-office communication scores lag the network average — and rolls a fix out everywhere it's needed, not just where a principal happened to notice.",
          benefits: [
            "Facilities and communication issues become owned cases instead of hallway conversations that go nowhere",
            "Campus-vs-campus comparison across a trust, so a facilities fix that worked at one school can be rolled out network-wide",
            "A recurring complaint pattern — the same issue at the same campus, three times in a month — gets flagged automatically",
            "Optional colleague feedback for staff, kept fully separate from family-facing surveys",
          ],
        },
        {
          slug: "retail",
          locationNoun: "store",
          name: "Retail",
          tagline: "Know which store, which shift, which fix actually worked.",
          heroBody:
            "A dip in your average rating tells you something's wrong somewhere. OodelCX tells you it's the Saturday afternoon shift at one specific store, and gives that store's manager a case with a due date instead of a number to shrug at.",
          standaloneBody:
            "One store, one QR code at checkout. Every flagged response — a stockout, a slow line, a rude interaction — becomes a case with an owner, so the next shift lead isn't guessing what needs fixing.",
          groupBody:
            "A multi-store chain compares every location and every shift pattern side by side, spots the store that's quietly dragging the network average down, and shares a playbook across the chain instead of reinventing the fix at each location.",
          benefits: [
            "Store-vs-store and shift-pattern comparison, not just one blended average",
            "A recurring complaint at one store — three stockout mentions in two weeks — gets flagged before it becomes a pattern nobody noticed",
            "Guided playbooks turn a repeat issue into a standard response the whole chain can reuse",
            "Downloadable reports for a regional or ops review, not a login every store manager has to remember",
          ],
        },
        {
          slug: "restaurants-hospitality",
          locationNoun: "location",
          name: "Restaurants & Hospitality",
          tagline: "A bad table turn shouldn't take a bad review to notice.",
          heroBody:
            "By the time a bad night shows up as a public review, it's too late to fix that guest's experience. OodelCX catches the same signal at the table, the same night, while there's still a shift manager who can do something about it.",
          standaloneBody:
            "One location, one QR code on the table or receipt. A flagged rating during service reaches the shift manager the same night, not the next morning's inbox review.",
          groupBody:
            "A multi-location group compares every restaurant and every daypart, spots the location whose service scores are sliding before it shows up in a review site, and shares what actually fixed it with every other location running the same menu.",
          benefits: [
            "Same-night visibility on a flagged table, routed to whoever's actually on shift",
            "Location-vs-location and daypart comparison, so a Friday-dinner problem doesn't get averaged away by a strong Tuesday lunch",
            "A recurring complaint — slow tickets, a specific dish, a specific server pattern — gets flagged as a pattern, not read one comment at a time",
            "Prove a service fix actually moved the number, with a real before/after, not a guess",
          ],
        },
        {
          slug: "healthcare",
          locationNoun: "facility",
          name: "Healthcare & Diagnostics",
          tagline: "A two-hour wait is a case, not just a complaint.",
          heroBody:
            "Patients tell you about the wait, the check-in, the way a result was explained — and most of that feedback never reaches anyone who can fix it. OodelCX turns a flagged visit into a case a clinical operations manager can actually close.",
          standaloneBody:
            "One clinic or facility, one QR code at check-in or discharge. A wait-time or communication complaint becomes an owned case the same day, not a comment card in a box nobody empties.",
          groupBody:
            "A multi-facility health network compares wait times and patient-experience scores across every location, spots the facility whose numbers are sliding, and rolls out a fix — a real-time wait tracker, a staffing adjustment — everywhere it's needed.",
          benefits: [
            "Wait-time and check-in complaints become owned cases with a due date, not a form in a box",
            "Facility-vs-facility benchmarking on the metrics that actually drive patient trust",
            "A recurring wait-time pattern at one facility gets flagged and turned into a tracked improvement initiative",
            "Prove an operational fix worked with a measured before/after, for the review board that asks",
          ],
        },
        {
          slug: "fitness",
          locationNoun: "location",
          name: "Fitness",
          tagline: "Know why a member's about to cancel before they do.",
          heroBody:
            "A member who's unhappy with equipment upkeep or a class rarely says so until they cancel. OodelCX catches the flagged feedback while there's still time for a location manager to do something about it.",
          standaloneBody:
            "One gym or studio, one QR code at the front desk or in the app flow. A complaint about equipment, cleanliness, or a class becomes a case for the location manager, not a comment that disappears into a suggestion box.",
          groupBody:
            "A multi-location chain compares every gym side by side — which location's equipment complaints keep recurring, which one's class-satisfaction scores lag — and rolls a fix out chain-wide before it shows up in membership churn.",
          benefits: [
            "Equipment, cleanliness, and class-satisfaction complaints become owned cases, not suggestion-box notes",
            "Location-vs-location comparison across the chain, so a real maintenance problem doesn't hide behind a strong overall average",
            "A recurring equipment complaint at one location gets flagged as a pattern before it costs you members",
            "Guided playbooks turn a known fix into a standard response every location manager can follow",
          ],
        },
        {
          slug: "automotive",
          locationNoun: "service center",
          name: "Automotive",
          tagline: "The service bay's real bottleneck, not just its star rating.",
          heroBody:
            "A dealership or service center's rating can hide exactly where it's losing customers — the estimate, the wait, the explanation of what actually got fixed. OodelCX turns a flagged visit into a case the service manager can close the same day.",
          standaloneBody:
            "One location, one QR code at the service desk or on the invoice. A complaint about the estimate, the wait, or the explanation of work done becomes a case for the service manager, not a note in a file.",
          groupBody:
            "A multi-location dealer group compares every service center side by side, spots the location whose wait-time or estimate-accuracy complaints keep recurring, and shares what fixed it with every other location.",
          benefits: [
            "Estimate, wait-time, and communication complaints become owned cases with a due date",
            "Location-vs-location comparison across a dealer group, not one blended average that hides the problem location",
            "A recurring complaint pattern at one service center gets flagged automatically",
            "Prove a service-process fix actually moved the number, with a real before/after",
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
