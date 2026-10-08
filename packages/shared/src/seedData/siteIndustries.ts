/**
 * Per-industry copy for the Solutions pages (/solutions/<slug>).
 *
 * Everything here is deliberately limited to what the platform really does:
 * feedback by QR code or link, themes across open comments, owners mapped by
 * category, alerts at a threshold, two-hour time-of-day concentration for
 * negative comments, branch-by-branch comparison, an escalation chain, a
 * Decision Log with before-and-after results, scheduled AI Insights reports,
 * and, for colleague feedback, one survey published to every branch with answers
 * visible only to the people head office chooses, and a branch left unnamed
 * until five people there have answered.
 * Wording is sector-neutral (branch, campus, store, site, station, dealership)
 * so it reads the same in any country.
 */

type Use = [icon: string, title: string, body: string];

interface Side {
  h: string;
  s: string;
  challenge: string;
  measures: string[];
  uses: [Use, Use, Use, Use];
  scene: string;
  steps: [string, string, string];
}

const industry = (o: { slug: string; name: string; tileBody: string; cx: Side; ex: Side }) => ({
  slug: o.slug,
  name: o.name,
  tileBody: o.tileBody,
  cxHeadline: o.cx.h,
  cxSub: o.cx.s,
  cxChallenge: o.cx.challenge,
  cxMeasures: o.cx.measures,
  cxUses: o.cx.uses.map(([icon, title, body]) => ({ icon, title, body })),
  cxScene: o.cx.scene,
  cxSteps: o.cx.steps,
  exHeadline: o.ex.h,
  exSub: o.ex.s,
  exChallenge: o.ex.challenge,
  exMeasures: o.ex.measures,
  exUses: o.ex.uses.map(([icon, title, body]) => ({ icon, title, body })),
  exScene: o.ex.scene,
  exSteps: o.ex.steps,
});

const BY_LINK = "Feedback arrives by QR code or link";
const CONCERN_LINK = "Concern arrives by QR code or link";
const OWNED = "Owner assigned, outcome measured";

export const SOLUTION_INDUSTRIES = [
  industry({
    slug: "banking",
    name: "Banking & Finance",
    tileBody: "Branch networks, with complaints recorded and routed",
    cx: {
      h: "Branch feedback, routed and recorded properly.",
      s: "Complaints about advice or fees need to reach the right function quickly, and the handling needs to be on record. Feedback held in branch inboxes does neither.",
      challenge:
        "A bank hears from customers at every branch and channel, but comments rarely reach one place. A service complaint and a concern about a product sale can sit in the same inbox with the same priority, and a regional lead may see neither until a quarterly review. When someone later asks who knew and what was done, the answer is hard to reconstruct.",
      measures: ["Waiting time", "Staff courtesy", "Clarity of fees and advice", "Handling of complaints", "Likelihood to recommend"],
      uses: [
        ["pin", "Branch-level visibility", "When a branch falls below its threshold, the regional lead is notified the same day."],
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["log", "A record for every case", "Each case keeps its owner, replies and decision history in one timeline."],
        ["pin", "Branch comparison", "Compare branches on the same categories, with each score set against its own history."],
      ],
      scene: "Branch 14: complaint about a product sale",
      steps: [BY_LINK, "Case assigned to the compliance owner", "Outcome recorded in the Decision Log"],
    },
    ex: {
      h: "Branch colleagues need a route that does not run through the branch.",
      s: "Front-line teams see process failures first, but raising a concern with a line manager is often not an option. A separate route changes what gets reported.",
      challenge:
        "Front-line staff see process failures, target pressure and customer-handling problems before anyone else. Raising them with a line manager is not always possible, so concerns surface late, often in exit interviews. Concerns about conduct are among those an organisation most needs to hear early.",
      measures: ["Workload", "Management support", "Training", "Tools and systems", "Likelihood to recommend (eNPS)"],
      uses: [
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["pin", "Branch comparison", "Compare colleague results by branch. Groups with fewer than five responses are never shown."],
        ["log", "Fixes with outcomes", "Log a rota or process change and compare results before and after."],
        ["pin", "One survey, every branch", "Build the staff survey once and publish it to every branch, each with its own link and QR code."],
      ],
      scene: "Branch 14: workload concern, anonymous",
      steps: [CONCERN_LINK, "Seen by the people head office chose", "Results read branch by branch"],
    },
  }),
  industry({
    slug: "education",
    name: "Education",
    tileBody: "Schools and trusts, compared term over term",
    cx: {
      h: "Comparing campuses on a consistent basis.",
      s: "Trusts need facilities, communication and pastoral measures from each site on the same scale, term by term, to see where support is needed.",
      challenge:
        "Parents, students and visitors raise issues with front offices, in group chats and at pick-up. Each campus handles them differently, so a trust sees a few loud issues and misses the quieter, recurring ones. Leaders need facilities, communication and pastoral measures from every site on the same scale.",
      measures: ["Facilities", "Communication with families", "Pastoral care", "Front-office service", "Catering and transport"],
      uses: [
        ["pin", "Campus comparison", "See which site is declining before the term review."],
        ["log", "Term-over-term trends", "Every score is set against the previous term."],
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["log", "Recurring issue flags", "The same issue raised repeatedly at one campus is flagged for review."],
      ],
      scene: "North Campus: communication score",
      steps: [BY_LINK, "Score down 0.4 this term", OWNED],
    },
    ex: {
      h: "Understanding staff experience across a trust.",
      s: "Teaching staff seldom have a confidential way to raise workload or leadership concerns, so these tend to surface late, often as resignations.",
      challenge:
        "Teaching and support staff seldom have a confidential way to raise workload, leadership or resourcing concerns. Without one, these emerge late, often as resignations at the end of a term, when little can be done about them.",
      measures: ["Workload", "Leadership support", "Resources", "Professional development", "Likelihood to recommend (eNPS)"],
      uses: [
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["pin", "Results by location and role", "Read patterns by campus and role. Groups with fewer than five responses are never shown."],
        ["log", "eNPS each term", "A trend line for the board, not a one-off survey."],
        ["pin", "Close the loop", "Tell staff what changed, without identifying who raised it."],
      ],
      scene: "Science department: workload theme",
      steps: [CONCERN_LINK, "Recurring for 3 weeks", OWNED],
    },
  }),
  industry({
    slug: "retail",
    name: "Retail",
    tileBody: "Which store and which time of day, not an average",
    cx: {
      h: "Finding the store and the time of day behind the average.",
      s: "A chain-wide average can conceal the single store, or trading period, where service falls short. Responses need to be traceable to both.",
      challenge:
        "A chain-wide score hides the one store, or the one trading period, where service falls short. Store managers receive a number without a reason, and head office sees averages when the fix is local and specific.",
      measures: ["Queues and waiting time", "Stock availability", "Staff helpfulness", "Store cleanliness", "Returns and refunds"],
      uses: [
        ["pin", "Store comparison", "Compare stores on the same categories and see which one is pulling the average down."],
        ["log", "Time-of-day patterns", "Negative comments are grouped into two-hour windows, so a lunchtime queue stands out."],
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["log", "Playbooks for repeat issues", "A recurring queue or stock problem gets the same agreed response across the chain."],
      ],
      scene: "Downtown: waiting time, midday",
      steps: [BY_LINK, "5 negative comments, 12:00–14:00", OWNED],
    },
    ex: {
      h: "Retention starts with hearing colleagues early.",
      s: "Turnover is high in retail, so concerns need to be raised through short surveys that suit shift patterns, by QR code or link.",
      challenge:
        "Turnover is high in retail, and shift patterns make long surveys impractical. Concerns about rotas, equipment and management are raised informally, if at all, and the cost appears later as vacancies.",
      measures: ["Scheduling and rotas", "Equipment and stock handling", "Manager support", "Training", "Likelihood to recommend (eNPS)"],
      uses: [
        ["pin", "Store comparison", "Compare colleague results across stores. Groups with fewer than five responses are never shown."],
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["log", "Rota changes, measured", "See whether a new scheduling policy moved the number."],
        ["pin", "Short, repeatable surveys", "A brief survey by QR code or link fits between shifts."],
      ],
      scene: "Store 22: scheduling theme",
      steps: [CONCERN_LINK, "eNPS 31 to 52 after the change", OWNED],
    },
  }),
  industry({
    slug: "healthcare",
    name: "Healthcare",
    tileBody: "Waiting-time complaints into a measured fix",
    cx: {
      h: "Turning patient feedback into tracked operational work.",
      s: "Patient comments often reach clinical operations as a periodic report. Facility networks need them to become owned cases with a measured result.",
      challenge:
        "Patient comments often reach clinical operations as a periodic report, long after the day they describe. Waiting time, communication and the clarity of information given are raised repeatedly, but without an owner or a measure the same issues return. Respondents can give feedback without identifying themselves.",
      measures: ["Waiting time", "Communication", "Check-in and discharge", "Cleanliness and environment", "Courtesy of staff"],
      uses: [
        ["pin", "Facility comparison", "Compare facilities on waiting time and other rated categories."],
        ["log", "Before and after", "Measure whether a new triage or check-in flow changed the score."],
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["log", "Escalation chain", "A case that stalls moves up the chain you define."],
      ],
      scene: "Clinic B: waiting-time complaint",
      steps: [BY_LINK, "Case assigned, due in 2 days", "Outcome recorded in the Decision Log"],
    },
    ex: {
      h: "Supporting the people who provide care.",
      s: "Pressure on clinical teams appears first as small, repeated signals. Identifying them early supports retention and continuity of care.",
      challenge:
        "Pressure on clinical and support teams shows first as small, repeated signals: understaffing, equipment, shift patterns. Without a safe channel they surface later as absence and turnover.",
      measures: ["Staffing levels", "Equipment", "Shift patterns", "Management support", "Likelihood to recommend (eNPS)"],
      uses: [
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["pin", "Site-level pulse", "Read results by site and role. Groups with fewer than five responses are never shown."],
        ["log", "Staffing decisions, measured", "Log a change and track the result."],
        ["pin", "Alert on a drop", "A fall in Colleague Pulse or eNPS below a threshold notifies the right person."],
      ],
      scene: "Site B: understaffing theme",
      steps: [CONCERN_LINK, "Seen by the people head office chose", OWNED],
    },
  }),
  industry({
    slug: "telecom",
    name: "Telecom",
    tileBody: "Stores, service points and repeat contacts",
    cx: {
      h: "Seeing service problems by store, channel and theme.",
      s: "The same complaint is often logged in several places. Feedback from stores and service points needs to be grouped by theme and traced to a cause.",
      challenge:
        "Telecom providers hear from customers in stores, service centres and through their own apps, and the same complaint is often recorded more than once. Repeat contacts about billing, coverage and installation are costly, yet rarely traced to a common cause.",
      measures: ["Billing clarity", "Network and coverage", "Installation and repair", "Store and service-centre experience", "Likelihood to recommend"],
      uses: [
        ["pin", "Store and service-point comparison", "Compare stores and service points on the same categories."],
        ["log", "Themes across comments", "Recurring topics such as billing or installation are grouped automatically."],
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["log", "Investigation", "See the time-of-day and branch concentration behind a drop in a category."],
      ],
      scene: "Store 9: billing confusion",
      steps: [BY_LINK, "12 mentions of billing this month", OWNED],
    },
    ex: {
      h: "Keeping service and field teams engaged.",
      s: "Contact-centre and field staff meet customer problems first. Tools, scripts and targets affect them before they affect the numbers.",
      challenge:
        "Contact-centre and field staff carry the pressure of customer problems. Scripts, tools and targets affect them first, but the signals are spread across teams, shifts and sites.",
      measures: ["Workload and targets", "Tools and systems", "Manager support", "Training", "Likelihood to recommend (eNPS)"],
      uses: [
        ["pin", "Team and site comparison", "Compare colleague results by site. Groups with fewer than five responses are never shown."],
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["log", "Changes, measured", "Log a change to a script or tool and compare results before and after."],
        ["pin", "Pulse over time", "Colleague Pulse and eNPS are tracked as a trend, not a single survey."],
      ],
      scene: "Service centre: tools theme",
      steps: [CONCERN_LINK, "Recurring for 3 weeks", OWNED],
    },
  }),
  industry({
    slug: "airlines",
    name: "Airlines & Aviation",
    tileBody: "Feedback at each stage of the journey",
    cx: {
      h: "Feedback at every stage of the journey.",
      s: "A journey passes through check-in, boarding, the flight and baggage, run by different teams. Feedback needs to be traceable to a stage and a place.",
      challenge:
        "A journey passes through booking, check-in, boarding, the flight and baggage, run by different teams and sometimes different companies. Feedback tends to arrive late, by email, and is hard to attribute to a stage or a location.",
      measures: ["Check-in and boarding", "Cabin service", "Punctuality and communication", "Baggage handling", "Lounge experience"],
      uses: [
        ["pin", "Feedback points by location", "Place a QR code at a gate, lounge or baggage hall, or send a link after the flight."],
        ["pin", "Station comparison", "Compare airports or stations on the same categories."],
        ["log", "Trends over time", "Every score is set against its own history."],
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
      ],
      scene: "Station C: baggage-claim wait",
      steps: [BY_LINK, "Concentrated in one time window", OWNED],
    },
    ex: {
      h: "Listening to crews and ground teams.",
      s: "Crews and ground staff work in shifts and across locations. Short surveys by QR code or link reach people who are rarely in one place.",
      challenge:
        "Crews and ground staff work in shifts, across locations and often away from base. Concerns about rosters, rest and equipment are difficult to collect from people who are rarely together.",
      measures: ["Rosters and rest", "Equipment and tools", "Management support", "Training", "Likelihood to recommend (eNPS)"],
      uses: [
        ["pin", "Short surveys by link or QR", "A brief survey suits people who are rarely in one place."],
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["pin", "Base comparison", "Compare colleague results by base. Groups with fewer than five responses are never shown."],
        ["log", "Roster changes, measured", "Log a change and compare results before and after."],
      ],
      scene: "Base 2: rostering theme",
      steps: [CONCERN_LINK, "Recurring for 3 weeks", OWNED],
    },
  }),
  industry({
    slug: "nonprofit",
    name: "Non-profit & NGOs",
    tileBody: "Programme feedback for funders and boards",
    cx: {
      h: "Evidence of programme quality, from the people you serve.",
      s: "Funders and boards ask what was delivered and what participants thought of it. Feedback from many locations needs to be comparable and recorded.",
      challenge:
        "Non-profits report to funders and boards on what was delivered and, increasingly, on what participants thought of it. Feedback is gathered at workshops and distribution points in many locations, but is often compiled by hand, late and unevenly.",
      measures: ["Session quality", "Facilitator", "Relevance of content", "Accessibility and inclusion", "Likelihood to recommend"],
      uses: [
        ["pin", "Comparison by event and facilitator", "Compare sessions, locations and facilitators on the same questions."],
        ["log", "Programme evaluation", "Compare what a training set out to deliver with what participants said."],
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["log", "Reports for funders and boards", "Export a structured report for any period."],
      ],
      scene: "Workshop, Site A: relevance score",
      steps: [BY_LINK, "Compared with the previous cohort", "Outcome recorded"],
    },
    ex: {
      h: "Hearing staff and volunteers across sites.",
      s: "Teams work across offices and field locations, often with limited resources. Strain tends to show as turnover rather than as complaints.",
      challenge:
        "Staff and volunteers work across offices and field locations, often with limited resources and high commitment. Strain tends to appear as turnover rather than as complaints, and concerns about managers are hard to raise in small teams.",
      measures: ["Workload", "Safety and wellbeing", "Resources", "Management support", "Likelihood to recommend (eNPS)"],
      uses: [
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["pin", "Location comparison", "Compare colleague results by location. Groups with fewer than five responses are never shown."],
        ["log", "Changes, measured", "Log a change and compare results before and after."],
        ["pin", "One survey, every branch", "Build the staff survey once and publish it to every branch, each with its own link and QR code."],
      ],
      scene: "Field office: workload theme",
      steps: [CONCERN_LINK, "Seen by the people head office chose", "Results read branch by branch"],
    },
  }),
  industry({
    slug: "automotive",
    name: "Automotive",
    tileBody: "Sales and service, by dealership and visit",
    cx: {
      h: "Sales and service feedback, by dealership and by visit.",
      s: "Purchase and service are run by different teams in different places. Feedback needs to stay separate for each and arrive while the visit is recent.",
      challenge:
        "Manufacturers and dealer groups depend on both the purchase and the service experience, which are handled by separate teams, often on separate sites. Feedback sits in manufacturer surveys and online reviews, and a dealership sees it long after the visit.",
      measures: ["Sales experience", "Service quality", "Time to complete a repair", "Communication", "Likelihood to recommend"],
      uses: [
        ["pin", "Dealership comparison", "Compare dealerships and service centres on the same categories."],
        ["pin", "Separate feedback points", "Use separate QR codes or links for sales, service and delivery."],
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["log", "Before and after", "Measure whether a change to the service process moved the score."],
      ],
      scene: "Dealership 7: service waiting time",
      steps: [BY_LINK, "Case assigned, due in 2 days", OWNED],
    },
    ex: {
      h: "Retaining technicians and service advisers.",
      s: "Skilled technicians are hard to hire and costly to replace. Concerns about equipment, workload and scheduling are usually raised informally.",
      challenge:
        "Technicians and service advisers are hard to hire and costly to replace. Concerns about workshop equipment, workload and scheduling are usually raised informally, and rarely reach the people who can change them.",
      measures: ["Workshop equipment", "Workload and scheduling", "Training", "Management support", "Likelihood to recommend (eNPS)"],
      uses: [
        ["pin", "Site comparison", "Compare colleague results by site. Groups with fewer than five responses are never shown."],
        ["shield", "Seen only by people you choose", "Staff responses go to the people head office picks, never to a line manager by default."],
        ["log", "Changes, measured", "Log an equipment or scheduling change and compare results before and after."],
        ["pin", "Short surveys by QR or link", "A brief survey fits around the workshop day."],
      ],
      scene: "Service centre: equipment theme",
      steps: [CONCERN_LINK, "Recurring for 3 weeks", OWNED],
    },
  }),
];
