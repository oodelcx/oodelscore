import { randomBytes } from "crypto";
import type { Types } from "mongoose";
import { Event as TrainingEvent } from "../models/Event";
import { FeedbackPoint } from "../models/FeedbackPoint";
import { QuestionTemplate, type IQuestion, type QuestionType } from "../models/QuestionTemplate";
import { Response as FeedbackResponse } from "../models/Response";
import { ProgramEvaluationReport } from "../models/ProgramEvaluationReport";

/**
 * Demo training programmes for the non-profit showcase account (Amani).
 *
 * Three programmes, each with stated objectives, an in-session QR survey and
 * (for sessions old enough) a 30-day follow-up sent by link. Every survey
 * question is written to ask about one of the programme's objectives, so
 * Program Evaluation has something specific to match. Responses are
 * generated with deliberate, believable variation between sessions (one
 * city stronger on a topic than another) so the evaluation has real
 * differences to find. All of it is demo data.
 */

type Role = "obj1" | "obj2" | "obj3" | "obj4" | "facilitator" | "nps" | "favourite" | "open";

interface QuestionSpec {
  role: Role;
  text: string;
  type: QuestionType;
  category?: string;
  options?: string[];
  csat?: boolean;
}

interface Comment {
  text: string;
  sentiment: "positive" | "neutral" | "negative";
  themes: string[];
}

interface SessionSpec {
  location: string;
  startsAgo: number; // negative = still upcoming
  durationDays: number;
  responses: number;
  followUps: number;
  /** Mean rating (1-5) for objectives 1-4; for a yes/no objective 4 this is read as a probability instead. */
  targets: { obj1: number; obj2: number; obj3: number; obj4: number };
  facilitator: number;
  promoters: number;
  /** Comments specific to this session's stand-out gap, mixed in alongside the general bank. */
  gapComments?: Comment[];
}

interface FollowUpSpec {
  questions: QuestionSpec[];
  /** Probability of "yes" for each yes/no question, in order. */
  yesRates: number[];
  /** Weights for the multiple-choice question's options, in order. */
  choiceWeights: number[];
  comments: Comment[];
}

interface ProgramSpec {
  name: string;
  seriesKey: string;
  facilitatorName: string;
  synopsis: string;
  objectives: string[];
  expectedOutcomes: string[];
  /** Which objectives are asked as yes/no instead of a 1-5 agreement rating. */
  obj4YesNo?: boolean;
  sessionQuestions: QuestionSpec[];
  /** Weights for the "most useful" multiple-choice question, in option order. */
  favouriteWeights: number[];
  comments: Comment[];
  sessions: SessionSpec[];
  followUp: FollowUpSpec;
}

const AGREE = "Rate how far you agree (1 = not at all, 5 = completely): ";

const PROGRAMS: ProgramSpec[] = [
  {
    name: "Women's Economic Empowerment Workshop",
    seriesKey: "womens-empowerment",
    facilitatorName: "F. Wanjiru",
    synopsis:
      "A two-day workshop for women entrepreneurs and savings-group leaders on running a small enterprise, managing money, and finding finance and peer support.",
    objectives: [
      "Participants can prepare a simple budget and track cash for a small enterprise.",
      "Participants know the main sources of savings and credit available to them and how to approach them.",
      "Participants gain confidence in setting prices and making business decisions.",
      "Participants form peer networks that continue to support each other after the workshop.",
    ],
    expectedOutcomes: [
      "Within 30 days, most participants keep a record of income and expenses.",
      "Within 60 days, at least half have joined a savings group or peer circle.",
    ],
    obj4YesNo: true,
    sessionQuestions: [
      { role: "obj1", type: "star_1_5", category: "Product Quality", text: `${AGREE}I can now prepare a simple budget and track cash for a small enterprise.` },
      { role: "obj2", type: "star_1_5", category: "Communication", text: `${AGREE}I know the main sources of savings and credit available to me and how to approach them.` },
      { role: "obj3", type: "star_1_5", category: "Product Quality", text: `${AGREE}I feel more confident setting prices and making business decisions.` },
      { role: "obj4", type: "yes_no", category: "Communication", text: "Did you exchange contacts with other participants so you can keep supporting each other?" },
      { role: "facilitator", type: "star_1_5", category: "Staff Friendliness", csat: true, text: "How would you rate the facilitator?" },
      { role: "nps", type: "nps_0_10", text: "How likely are you to recommend this workshop to another woman entrepreneur?" },
      {
        role: "favourite",
        type: "multiple_choice",
        text: "Which part was most useful to you?",
        options: ["Budgeting and cash tracking", "Savings and credit options", "Pricing and negotiation", "Meeting other participants"],
      },
      { role: "open", type: "open_text", text: "What is one thing you will do differently in the next 30 days?" },
    ],
    favouriteWeights: [4, 2.2, 3, 2.6],
    comments: [
      { text: "I finally understand how to separate my shop money from the money for my household.", sentiment: "positive", themes: ["budgeting"] },
      { text: "The cash book exercise was simple and I started using it the same week.", sentiment: "positive", themes: ["budgeting", "practical exercises"] },
      { text: "Learning how to set prices without losing customers gave me confidence.", sentiment: "positive", themes: ["pricing confidence"] },
      { text: "It was good to meet other women who run small businesses like mine. We now share a WhatsApp group.", sentiment: "positive", themes: ["peer network"] },
      { text: "The facilitator explained everything patiently, in a language we all understood.", sentiment: "positive", themes: ["facilitator"] },
      { text: "I will start writing down every sale, even the small ones.", sentiment: "positive", themes: ["budgeting"] },
      { text: "Useful, but two days felt too short for everything we covered.", sentiment: "neutral", themes: ["session length"] },
      { text: "I liked the budgeting part. The savings and loans section went too fast for me.", sentiment: "neutral", themes: ["savings and credit information", "pacing"] },
      { text: "The examples were mostly from town businesses. Mine is in the village market.", sentiment: "negative", themes: ["relevance for rural participants"] },
      { text: "I still do not know where I can get a small loan. We needed names and contacts of lenders.", sentiment: "negative", themes: ["access to finance"] },
    ],
    sessions: [
      {
        location: "Nairobi",
        startsAgo: 50,
        durationDays: 2,
        responses: 30,
        followUps: 12,
        targets: { obj1: 4.5, obj2: 3.2, obj3: 4.2, obj4: 0.72 },
        facilitator: 4.6,
        promoters: 0.72,
      },
      {
        location: "Kampala",
        startsAgo: 25,
        durationDays: 2,
        responses: 26,
        followUps: 0,
        targets: { obj1: 4.3, obj2: 2.6, obj3: 4.0, obj4: 0.55 },
        facilitator: 4.5,
        promoters: 0.6,
        gapComments: [
          { text: "Mobile money fees and the nearest bank branch are far from us. The session did not say how to manage that.", sentiment: "negative", themes: ["access to finance", "mobile money"] },
          { text: "Please bring someone from a savings group or a microfinance institution next time.", sentiment: "negative", themes: ["access to finance", "partner organisations"] },
          { text: "We learned about savings groups, but nobody told us how to join one near us.", sentiment: "negative", themes: ["savings and credit information"] },
        ],
      },
      {
        location: "Kigali",
        startsAgo: -4,
        durationDays: 2,
        responses: 0,
        followUps: 0,
        targets: { obj1: 4.3, obj2: 3.0, obj3: 4.0, obj4: 0.6 },
        facilitator: 4.5,
        promoters: 0.6,
      },
    ],
    followUp: {
      questions: [
        { role: "obj1", type: "yes_no", category: "Product Quality", text: "Have you started tracking your income and expenses since the workshop?" },
        {
          role: "obj2",
          type: "multiple_choice",
          category: "Communication",
          text: "Have you saved or joined a savings group since the workshop?",
          options: ["Yes, I joined a group", "Yes, I save on my own", "Not yet, but I plan to", "No"],
        },
        { role: "obj4", type: "yes_no", category: "Communication", text: "Are you still in touch with other participants?" },
        { role: "open", type: "open_text", text: "What has made it hard to apply what you learned, or what helped?" },
      ],
      yesRates: [0.75, 0.6],
      choiceWeights: [3, 3.5, 2.5, 1.5],
      comments: [
        { text: "I now save a little every market day. My husband was surprised.", sentiment: "positive", themes: ["savings habit"] },
        { text: "I joined a savings group through the contacts I made at the workshop.", sentiment: "positive", themes: ["peer network", "savings habit"] },
        { text: "Time is my biggest problem. I run the shop alone and forget to write things down.", sentiment: "negative", themes: ["time pressure"] },
        { text: "Phone credit is expensive, so a paper book works better for my records.", sentiment: "neutral", themes: ["practical barriers"] },
        { text: "I tracked my sales for a month and found which item was losing me money.", sentiment: "positive", themes: ["budgeting"] },
      ],
    },
  },
  {
    name: "Community Peacebuilding Dialogue",
    seriesKey: "peacebuilding",
    facilitatorName: "T. Achieng",
    synopsis:
      "A three-day dialogue programme that builds the everyday skills of listening, calm communication and simple facilitation so that community members can address tension early.",
    objectives: [
      "Participants can use active listening and non-blaming language across differences.",
      "Participants can recognise early signs of local tension and know who to involve.",
      "Participants feel able to facilitate a simple dialogue between two parties in their own community.",
      "Participants experience the sessions as a safe and respectful space.",
    ],
    expectedOutcomes: [
      "Within 60 days, most participants hold or join at least one community conversation.",
      "Participants report using the skills to help settle a real disagreement.",
    ],
    sessionQuestions: [
      { role: "obj1", type: "star_1_5", category: "Product Quality", text: `${AGREE}I can now listen across differences without blaming, and use calmer language.` },
      { role: "obj2", type: "star_1_5", category: "Communication", text: `${AGREE}I can recognise early signs of tension in my community and I know who to involve.` },
      { role: "obj3", type: "star_1_5", category: "Product Quality", text: `${AGREE}I feel able to facilitate a simple dialogue between two people in conflict.` },
      { role: "obj4", type: "star_1_5", category: "Facilities", text: `${AGREE}I felt this was a safe and respectful space for everyone.` },
      { role: "facilitator", type: "star_1_5", category: "Staff Friendliness", csat: true, text: "How would you rate the facilitator?" },
      { role: "nps", type: "nps_0_10", text: "How likely are you to recommend this dialogue programme to someone in your community?" },
      {
        role: "favourite",
        type: "multiple_choice",
        text: "Which activity helped you most?",
        options: ["Listening pairs", "Role-play of a local dispute", "Mapping tensions in our community", "Group reflection"],
      },
      { role: "open", type: "open_text", text: "What will you try in your community in the next 60 days?" },
    ],
    favouriteWeights: [3.5, 3, 2, 2.2],
    comments: [
      { text: "The listening pairs exercise changed how I talk with my neighbour. I stopped interrupting.", sentiment: "positive", themes: ["active listening"] },
      { text: "For the first time I could say what I felt without being shouted down.", sentiment: "positive", themes: ["safe space"] },
      { text: "The role-play of a land dispute was very close to what happens in our community.", sentiment: "positive", themes: ["role-play", "relevance"] },
      { text: "The facilitator was calm and never took sides.", sentiment: "positive", themes: ["facilitator", "neutrality"] },
      { text: "I want to start with a small conversation at the water point in my area.", sentiment: "positive", themes: ["community conversation"] },
      { text: "I can listen better now, but I would not yet dare to lead a dialogue between two angry families.", sentiment: "neutral", themes: ["confidence to facilitate"] },
      { text: "More time on mapping tension would help. We ran out of time.", sentiment: "neutral", themes: ["session length"] },
      { text: "We practised a lot, but I am afraid to facilitate alone. I need a second workshop or a mentor.", sentiment: "negative", themes: ["confidence to facilitate", "mentoring"] },
      { text: "Some participants were still angry at the start. The ground rules should be firmer.", sentiment: "negative", themes: ["ground rules"] },
    ],
    sessions: [
      {
        location: "Juba",
        startsAgo: 38,
        durationDays: 3,
        responses: 24,
        followUps: 10,
        targets: { obj1: 4.3, obj2: 3.9, obj3: 3.0, obj4: 4.6 },
        facilitator: 4.5,
        promoters: 0.65,
        gapComments: [
          { text: "I need someone experienced beside me the first time I facilitate. Can Amani connect us with a mentor?", sentiment: "negative", themes: ["confidence to facilitate", "mentoring"] },
          { text: "The skills are clear, but leading a real conversation in my area feels risky.", sentiment: "negative", themes: ["confidence to facilitate"] },
        ],
      },
      {
        location: "Bujumbura",
        startsAgo: 15,
        durationDays: 3,
        responses: 20,
        followUps: 0,
        targets: { obj1: 4.4, obj2: 4.0, obj3: 3.5, obj4: 4.7 },
        facilitator: 4.7,
        promoters: 0.75,
      },
    ],
    followUp: {
      questions: [
        { role: "obj3", type: "yes_no", category: "Communication", text: "Have you held or joined a community conversation since the dialogue?" },
        {
          role: "favourite",
          type: "multiple_choice",
          text: "Which skill have you used most?",
          options: ["Active listening", "Calming language", "Involving the right people", "Facilitating a conversation", "None yet"],
        },
        { role: "obj1", type: "yes_no", category: "Product Quality", text: "Have you used these skills to help settle a disagreement?" },
        { role: "open", type: "open_text", text: "What helped, or what got in the way?" },
      ],
      yesRates: [0.5, 0.4],
      choiceWeights: [4, 3, 1.8, 1, 1.2],
      comments: [
        { text: "I invited three neighbours for tea and we talked about the water point. It went well.", sentiment: "positive", themes: ["community conversation"] },
        { text: "I used the calm words with my cousin during an argument over inheritance.", sentiment: "positive", themes: ["calming language"] },
        { text: "People in my area are not ready to sit together yet.", sentiment: "negative", themes: ["community readiness"] },
        { text: "I need support from someone experienced to facilitate a real conversation.", sentiment: "negative", themes: ["mentoring", "confidence to facilitate"] },
        { text: "Listening first has changed arguments at home.", sentiment: "positive", themes: ["active listening"] },
      ],
    },
  },
  {
    name: "Peace Through Sufi Traditions: Compassion and Dialogue",
    seriesKey: "sufi-peace",
    facilitatorName: "A. Qureshi",
    synopsis:
      "A dialogue retreat drawing on Sufi traditions of compassion, listening and service, such as reflective practice and classical poetry, to build inner calm and respect across communities. Open to participants of every faith and none.",
    objectives: [
      "Participants learn reflective practices they can use to stay calm in conflict.",
      "Participants deepen empathy and respect toward people of other faiths and communities.",
      "Participants feel included whatever their own faith or beliefs.",
      "Participants identify one way to bring compassion into community life or service.",
    ],
    expectedOutcomes: [
      "Within 30 days, most participants keep up at least one reflective practice.",
      "Within 60 days, participants take part in a community or service activity alongside people of another background.",
    ],
    sessionQuestions: [
      { role: "obj1", type: "star_1_5", category: "Product Quality", text: `${AGREE}I learned reflective practices, such as contemplative listening or breath awareness, that help me stay calm in conflict.` },
      { role: "obj2", type: "star_1_5", category: "Communication", text: `${AGREE}I feel more empathy and respect toward people of other faiths and communities.` },
      { role: "obj3", type: "star_1_5", category: "Facilities", text: `${AGREE}I felt included whatever my own faith or beliefs.` },
      { role: "obj4", type: "star_1_5", category: "Product Quality", text: `${AGREE}I can name one way to bring compassion into my community or service.` },
      { role: "facilitator", type: "star_1_5", category: "Staff Friendliness", csat: true, text: "How would you rate the facilitator?" },
      { role: "nps", type: "nps_0_10", text: "How likely are you to recommend this retreat to a friend or colleague?" },
      {
        role: "favourite",
        type: "multiple_choice",
        text: "Which session helped you most?",
        options: ["Contemplative listening circle", "Reading and reflection on classical poetry", "Silent walking and breathing practice", "Group conversation across communities"],
      },
      { role: "open", type: "open_text", text: "What will you take from this retreat into your daily life?" },
    ],
    favouriteWeights: [3.4, 3, 2.2, 3.2],
    comments: [
      { text: "The contemplative listening circle helped me slow down. I now take a few minutes of silence before I respond.", sentiment: "positive", themes: ["reflective practice"] },
      { text: "Reading classical poetry together reminded us that compassion is not limited to one community.", sentiment: "positive", themes: ["poetry", "empathy"] },
      { text: "I am not very religious, yet I felt fully welcome.", sentiment: "positive", themes: ["inclusion"] },
      { text: "Learning how to stay calm when I am angry is something I will use at work and at home.", sentiment: "positive", themes: ["calm in conflict"] },
      { text: "Meeting people from different sects and faiths in one room was valuable.", sentiment: "positive", themes: ["dialogue across communities"] },
      { text: "Beautiful sessions. I am not sure how to bring this into my community work. A practical guide would help.", sentiment: "neutral", themes: ["applying to community life"] },
      { text: "Some sessions were long. Shorter periods of silence would suit me.", sentiment: "neutral", themes: ["pacing"] },
      { text: "I expected more practical steps for service projects, not only reflection.", sentiment: "negative", themes: ["applying to community life"] },
    ],
    sessions: [
      {
        location: "Islamabad",
        startsAgo: 40,
        durationDays: 3,
        responses: 28,
        followUps: 11,
        targets: { obj1: 4.4, obj2: 4.5, obj3: 4.7, obj4: 3.4 },
        facilitator: 4.7,
        promoters: 0.78,
        gapComments: [
          { text: "I would like a short guide on turning these practices into a neighbourhood service project.", sentiment: "neutral", themes: ["applying to community life"] },
          { text: "The reflection was deep. Next time please include one practical service activity.", sentiment: "neutral", themes: ["applying to community life"] },
        ],
      },
      {
        location: "Lahore",
        startsAgo: 8,
        durationDays: 2,
        responses: 3,
        followUps: 0,
        targets: { obj1: 4.5, obj2: 4.5, obj3: 4.8, obj4: 3.6 },
        facilitator: 4.8,
        promoters: 0.8,
      },
    ],
    followUp: {
      questions: [
        { role: "obj1", type: "yes_no", category: "Product Quality", text: "Have you kept up any of the reflective practices since the retreat?" },
        {
          role: "favourite",
          type: "multiple_choice",
          text: "How often do you practise?",
          options: ["Daily", "A few times a week", "Occasionally", "Not at all"],
        },
        { role: "obj4", type: "yes_no", category: "Communication", text: "Have you taken part in a community or service activity with people of another background?" },
        { role: "open", type: "open_text", text: "What helped, or what got in the way?" },
      ],
      yesRates: [0.64, 0.45],
      choiceWeights: [2.5, 3.5, 2.5, 1.4],
      comments: [
        { text: "I still do the breathing practice most mornings.", sentiment: "positive", themes: ["reflective practice"] },
        { text: "I joined a food distribution drive with colleagues from another community.", sentiment: "positive", themes: ["community service"] },
        { text: "My schedule got busy and I stopped the practices after two weeks.", sentiment: "negative", themes: ["time pressure"] },
        { text: "The poetry readings stayed with me. I share a verse with my family on Fridays.", sentiment: "positive", themes: ["poetry", "empathy"] },
      ],
    },
  },
];

const AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55-64"];
const DAY_MS = 24 * 60 * 60 * 1000;

const rand = (): number => Math.random();
const randInt = (a: number, b: number): number => a + Math.floor(rand() * (b - a + 1));
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];

function gaussian(): number {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A 1-5 rating centred on `mean`, with realistic spread. */
function rating(mean: number, spread = 0.75): number {
  return Math.max(1, Math.min(5, Math.round(mean + gaussian() * spread)));
}

function weightedIndex(weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function recommendScore(promoters: number): number {
  const r = rand();
  if (r < promoters) return pick([9, 9, 10, 10, 10]);
  if (r < promoters + (1 - promoters) * 0.6) return pick([7, 8, 8]);
  return randInt(3, 6);
}

export interface AmaniLowScoreEvent {
  businessId: Types.ObjectId;
  parentOrgId: null;
  responseId: Types.ObjectId;
  submittedAt: Date;
  categoryId: Types.ObjectId | null;
  starValue: number;
  comment: string | null;
}

export interface AmaniProgramsResult {
  /** One QR feedback point per session, in programme order. */
  qrPoints: InstanceType<typeof FeedbackPoint>[];
  eventIds: { id: Types.ObjectId; ended: boolean; name: string; location: string }[];
  lowScoreEvents: AmaniLowScoreEvent[];
  sessionResponses: number;
  followUpResponses: number;
  followUpPoints: number;
}

function toQuestion(spec: QuestionSpec, categoryByName: Map<string, Types.ObjectId>): IQuestion {
  return {
    text: spec.text,
    type: spec.type,
    categoryId: spec.category ? (categoryByName.get(spec.category) ?? null) : null,
    required: spec.role === "facilitator" || spec.role === "nps",
    options: spec.options ?? [],
    isCsatQuestion: spec.csat ?? false,
  };
}

/**
 * Wipes and rebuilds Amani's programmes, sessions, feedback points (QR for the
 * session, link for the 30-day follow-up) and responses. Returns what the
 * caller needs to hang cases/alerts off, and which events can be evaluated.
 */
export async function seedAmaniPrograms(params: {
  businessId: Types.ObjectId;
  categoryByName: Map<string, Types.ObjectId>;
  now?: Date;
}): Promise<AmaniProgramsResult> {
  const now = params.now ?? new Date();
  const { businessId, categoryByName } = params;

  // Clean slate for this account's programme data so a re-run never piles up duplicates.
  await ProgramEvaluationReport.deleteMany({ businessId });
  await FeedbackResponse.deleteMany({ businessId });
  await FeedbackPoint.deleteMany({ businessId });
  await TrainingEvent.deleteMany({ businessId });

  const out: AmaniProgramsResult = { qrPoints: [], eventIds: [], lowScoreEvents: [], sessionResponses: 0, followUpResponses: 0, followUpPoints: 0 };

  for (const program of PROGRAMS) {
    const sessionQs = program.sessionQuestions.map((q) => toQuestion(q, categoryByName));
    const followQs = program.followUp.questions.map((q) => toQuestion(q, categoryByName));
    const sessionTemplate = await QuestionTemplate.findOneAndUpdate(
      { name: `${program.name}: session feedback` },
      { $set: { name: `${program.name}: session feedback`, product: "customer_experience", suggestedIndustries: ["Community Development & Training"], questions: sessionQs } },
      { upsert: true, new: true }
    );
    const followTemplate = await QuestionTemplate.findOneAndUpdate(
      { name: `${program.name}: 30-day follow-up` },
      { $set: { name: `${program.name}: 30-day follow-up`, product: "customer_experience", suggestedIndustries: ["Community Development & Training"], questions: followQs } },
      { upsert: true, new: true }
    );

    for (const session of program.sessions) {
      const startsAt = new Date(now.getTime() - session.startsAgo * DAY_MS);
      const endsAt = new Date(startsAt.getTime() + session.durationDays * DAY_MS);
      const event = await TrainingEvent.findOneAndUpdate(
        { businessId, name: program.name, location: session.location, startsAt },
        {
          $set: {
            businessId,
            name: program.name,
            seriesKey: program.seriesKey,
            facilitator: program.facilitatorName,
            location: session.location,
            startsAt,
            endsAt,
            expectedAttendees: session.responses > 0 ? session.responses + randInt(4, 10) : 30,
            category: "training",
            programDetails: { synopsis: program.synopsis, objectives: program.objectives, expectedOutcomes: program.expectedOutcomes },
          },
        },
        { upsert: true, new: true }
      );
      out.eventIds.push({ id: event._id, ended: endsAt.getTime() <= now.getTime(), name: program.name, location: session.location });

      // In-session survey: a QR code on the handout.
      const qrPoint = await FeedbackPoint.create({
        businessId,
        product: "customer_experience",
        eventId: event._id,
        questionTemplateOverride: sessionTemplate._id,
        name: `${program.name} — ${session.location}`,
        description: `QR code on the session handout: end-of-session feedback for ${program.name} in ${session.location}.`,
        deliveryMode: "qr",
        qrToken: randomBytes(16).toString("hex"),
        scans: session.responses + (session.responses > 0 ? randInt(2, 8) : 0),
        active: true,
        startsAt,
        endsAt: session.startsAgo >= 0 ? endsAt : null,
      });
      out.qrPoints.push(qrPoint);

      const sessionDocs: Record<string, unknown>[] = [];
      for (let i = 0; i < session.responses; i++) {
        const submittedAt = new Date(Math.min(now.getTime(), startsAt.getTime() + rand() * (session.durationDays + 2) * DAY_MS));
        const ageGroup = rand() < 0.7 ? pick(AGE_GROUPS) : "";
        // Younger participants run a little lower on confidence-type objectives.
        const ageAdjust = ageGroup === "18-24" ? -0.25 : ageGroup === "55-64" ? -0.1 : 0;
        const answers = [] as { questionId: Types.ObjectId; type: QuestionType; value: unknown; categoryId: Types.ObjectId | null }[];
        const ratings: number[] = [];
        let ratingSum = 0;
        let ratingN = 0;
        sessionTemplate.questions.forEach((q, qi) => {
          const spec = program.sessionQuestions[qi];
          let value: unknown = null;
          switch (spec.role) {
            case "obj1":
            case "obj2":
            case "obj3":
            case "obj4": {
              if (spec.type === "yes_no") {
                value = rand() < session.targets[spec.role] ? "yes" : "no";
              } else {
                const v = rating(session.targets[spec.role] + (spec.role === "obj3" ? ageAdjust : 0));
                value = v;
                ratings.push(v);
                ratingSum += v;
                ratingN++;
              }
              break;
            }
            case "facilitator": {
              const v = rating(session.facilitator, 0.6);
              value = v;
              ratingSum += v;
              ratingN++;
              break;
            }
            case "nps":
              value = recommendScore(session.promoters);
              break;
            case "favourite":
              value = spec.options![weightedIndex(program.favouriteWeights)];
              break;
            case "open":
              value = "";
              break;
          }
          answers.push({ questionId: q._id!, type: q.type, value, categoryId: q.categoryId ?? null });
        });

        // Comment: mostly matched to how the person rated overall, sometimes this session's stand-out gap.
        const mean = ratingN ? ratingSum / ratingN : 4;
        const mood: Comment["sentiment"] = mean >= 4.1 ? "positive" : mean >= 3.3 ? "neutral" : "negative";
        let comment: Comment | null = null;
        if (rand() < 0.72) {
          if (session.gapComments && rand() < 0.4) comment = pick(session.gapComments);
          else {
            const pool = program.comments.filter((c) => c.sentiment === mood);
            comment = pick(pool.length ? pool : program.comments);
          }
        }
        const openIndex = program.sessionQuestions.findIndex((q) => q.role === "open");
        if (comment) answers[openIndex].value = comment.text;

        sessionDocs.push({
          feedbackPointId: qrPoint._id,
          businessId,
          product: "customer_experience",
          eventId: event._id,
          answers,
          respondentName: null,
          respondentEmail: null,
          respondentPhone: null,
          demographics: { ageGroup, gender: "" },
          submittedAt,
          deviceType: pick(["mobile", "mobile", "mobile", "tablet"] as const),
          flagged: false,
          sentiment: comment ? comment.sentiment : null,
          themes: comment ? comment.themes : [],
          sentimentAnalyzedAt: comment ? submittedAt : null,
          _lowest: Math.min(...(ratings.length ? ratings : [5])),
        });
      }
      if (sessionDocs.length) {
        const inserted = await FeedbackResponse.insertMany(sessionDocs.map(({ _lowest, ...doc }) => { void _lowest; return doc; }));
        out.sessionResponses += inserted.length;
        inserted.forEach((resp, idx) => {
          const doc = sessionDocs[idx];
          const lowest = doc._lowest as number;
          if (lowest <= 2) {
            const answers = doc.answers as { type: string; value: unknown; categoryId: Types.ObjectId | null }[];
            const worst = answers.filter((a) => a.type === "star_1_5" && typeof a.value === "number").sort((a, b) => (a.value as number) - (b.value as number))[0];
            const text = answers.find((a) => a.type === "open_text" && typeof a.value === "string" && a.value)?.value as string | undefined;
            out.lowScoreEvents.push({
              businessId,
              parentOrgId: null,
              responseId: resp._id as Types.ObjectId,
              submittedAt: doc.submittedAt as Date,
              categoryId: worst?.categoryId ?? null,
              starValue: (worst?.value as number) ?? lowest,
              comment: text ?? null,
            });
          }
        });
      }

      // 30-day follow-up by link, only once the session is old enough to have one.
      if (session.followUps > 0) {
        const linkPoint = await FeedbackPoint.create({
          businessId,
          product: "customer_experience",
          eventId: event._id,
          questionTemplateOverride: followTemplate._id,
          name: `${program.name} — ${session.location}: 30-day follow-up`,
          description: `Link sent by WhatsApp and email 30 days after the session (${session.location}).`,
          deliveryMode: "link",
          qrToken: randomBytes(16).toString("hex"),
          scans: session.followUps + randInt(3, 9),
          active: true,
          startsAt: new Date(endsAt.getTime() + 20 * DAY_MS),
          endsAt: null,
        });
        out.followUpPoints++;
        const follow = program.followUp;
        const docs: Record<string, unknown>[] = [];
        for (let i = 0; i < session.followUps; i++) {
          const submittedAt = new Date(Math.min(now.getTime(), endsAt.getTime() + (24 + rand() * 14) * DAY_MS));
          let yesIdx = 0;
          const answers = followTemplate.questions.map((q, qi) => {
            const spec = follow.questions[qi];
            let value: unknown = "";
            if (spec.type === "yes_no") {
              value = rand() < (follow.yesRates[yesIdx++] ?? 0.5) ? "yes" : "no";
            } else if (spec.type === "multiple_choice") {
              value = spec.options![weightedIndex(follow.choiceWeights)];
            } else if (spec.type === "open_text") {
              value = "";
            }
            return { questionId: q._id!, type: q.type, value, categoryId: q.categoryId ?? null };
          });
          let comment: Comment | null = null;
          if (rand() < 0.75) comment = pick(follow.comments);
          const openIdx = follow.questions.findIndex((q) => q.role === "open");
          if (comment) answers[openIdx].value = comment.text;
          docs.push({
            feedbackPointId: linkPoint._id,
            businessId,
            product: "customer_experience",
            eventId: event._id,
            answers,
            respondentName: null,
            respondentEmail: null,
            respondentPhone: null,
            demographics: { ageGroup: rand() < 0.6 ? pick(AGE_GROUPS) : "", gender: "" },
            submittedAt,
            deviceType: pick(["mobile", "mobile", "desktop"] as const),
            flagged: false,
            sentiment: comment ? comment.sentiment : null,
            themes: comment ? comment.themes : [],
            sentimentAnalyzedAt: comment ? submittedAt : null,
          });
        }
        const inserted = await FeedbackResponse.insertMany(docs);
        out.followUpResponses += inserted.length;
      }
    }
  }
  return out;
}
