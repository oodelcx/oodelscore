import type { ProgramSpec, QuestionSpec } from "./amaniPrograms";

/**
 * Community Education programmes run by Precision Diagnostics Network, the
 * demo healthcare group. Each programme states objectives, asks survey
 * questions about those objectives, and has sessions in different cities
 * with believable differences (one city stronger on a topic), so Program
 * Evaluation has something real to find. All demo data.
 */
const AGREE = "Rate how far you agree (1 = not at all, 5 = completely): ";

const facilitator = (): QuestionSpec => ({ role: "facilitator", type: "star_1_5", category: "Staff Friendliness", csat: true, text: "How would you rate the doctor or educator who led the session?" });

export const PRECISION_PROGRAMS: ProgramSpec[] = [
  {
    name: "Diabetes and Heart Health Awareness Camp",
    seriesKey: "diabetes-heart-camp",
    facilitatorName: "Dr. S. Rehman",
    synopsis: "A half-day community camp with free screening, a short talk and a Q&A on preventing and managing diabetes and heart disease.",
    objectives: [
      "Participants can name the main warning signs of diabetes and heart disease.",
      "Participants understand what a healthy blood sugar and blood pressure reading looks like.",
      "Participants know how often to get screened and where to go.",
      "Participants book a follow-up screening at a Precision centre.",
    ],
    expectedOutcomes: [
      "Within 30 days, at least half of attendees complete a follow-up screening.",
      "Within 60 days, attendees report changing one daily habit.",
    ],
    obj4YesNo: true,
    sessionQuestions: [
      { role: "obj1", type: "star_1_5", category: "Communication", text: `${AGREE}I can name the main warning signs of diabetes and heart disease.` },
      { role: "obj2", type: "star_1_5", category: "Communication", text: `${AGREE}I understand what a healthy blood sugar and blood pressure reading looks like.` },
      { role: "obj3", type: "star_1_5", category: "Communication", text: `${AGREE}I know how often I should be screened and where to go.` },
      { role: "obj4", type: "yes_no", category: "Service Speed", text: "Did you book a follow-up screening before leaving?" },
      facilitator(),
      { role: "nps", type: "nps_0_10", text: "How likely are you to recommend this camp to family or neighbours?" },
      { role: "favourite", type: "multiple_choice", text: "Which part was most useful?", options: ["Free screening", "The talk on warning signs", "Diet and exercise advice", "Question and answer time"] },
      { role: "open", type: "open_text", text: "What is one thing you will change in your daily routine?" },
    ],
    favouriteWeights: [4, 3, 2.4, 2.6],
    comments: [
      { text: "The screening was quick and the doctor explained my reading in plain words.", sentiment: "positive", themes: ["free screening", "clear explanation"] },
      { text: "I did not know sudden tiredness could be a sign of diabetes. I will get my family tested.", sentiment: "positive", themes: ["warning signs"] },
      { text: "Booking the follow-up at the desk was easy. They even sent a reminder.", sentiment: "positive", themes: ["follow-up booking"] },
      { text: "The talk was clear and the doctor answered every question patiently.", sentiment: "positive", themes: ["facilitator"] },
      { text: "I will cut sugar in my tea and start walking in the evening.", sentiment: "positive", themes: ["lifestyle change"] },
      { text: "Useful, but the camp was crowded and the queue for screening was long.", sentiment: "neutral", themes: ["queue", "crowding"] },
      { text: "Good advice, though I would have liked a printed diet chart to take home.", sentiment: "neutral", themes: ["take-home material"] },
      { text: "I still do not know which centre is closest to my village for the follow-up test.", sentiment: "negative", themes: ["access to follow-up", "centre locations"] },
      { text: "Information was given only in English and Urdu. Many elders needed it in Punjabi.", sentiment: "negative", themes: ["language", "elders"] },
    ],
    sessions: [
      { location: "Lahore", startsAgo: 48, durationDays: 1, responses: 32, followUps: 12, targets: { obj1: 4.5, obj2: 4.2, obj3: 3.9, obj4: 0.7 }, facilitator: 4.6, promoters: 0.72 },
      {
        location: "Multan",
        startsAgo: 22,
        durationDays: 1,
        responses: 26,
        followUps: 0,
        targets: { obj1: 4.3, obj2: 4.0, obj3: 2.7, obj4: 0.45 },
        facilitator: 4.5,
        promoters: 0.62,
        gapComments: [
          { text: "Nobody told us where the nearest Precision centre is for the follow-up test.", sentiment: "negative", themes: ["access to follow-up", "centre locations"] },
          { text: "The talk was good but I left without knowing how often I should be screened.", sentiment: "negative", themes: ["screening frequency"] },
          { text: "Please give a card with the centre address and phone number.", sentiment: "negative", themes: ["take-home material", "centre locations"] },
        ],
      },
      { location: "Faisalabad", startsAgo: -6, durationDays: 1, responses: 0, followUps: 0, targets: { obj1: 4.3, obj2: 4.0, obj3: 3.6, obj4: 0.6 }, facilitator: 4.5, promoters: 0.6 },
    ],
    followUp: {
      questions: [
        { role: "obj1", type: "yes_no", category: "Service Speed", text: "Have you had a follow-up screening since the camp?" },
        { role: "obj2", type: "multiple_choice", category: "Communication", text: "Have you changed anything in your daily routine since the camp?", options: ["Yes, my diet", "Yes, I exercise more", "Both", "Not yet"] },
        { role: "obj4", type: "yes_no", category: "Communication", text: "Have you told family or friends what you learned?" },
        { role: "open", type: "open_text", text: "What helped or got in the way of acting on the advice?" },
      ],
      yesRates: [0.55, 0.8],
      choiceWeights: [3, 2.5, 3.2, 1.8],
      comments: [
        { text: "I went for the screening the same month and my sugar was borderline. Glad I did.", sentiment: "positive", themes: ["follow-up screening"] },
        { text: "My wife and I now walk every evening after Isha prayers.", sentiment: "positive", themes: ["lifestyle change"] },
        { text: "The centre is too far from my home and I could not take time off work.", sentiment: "negative", themes: ["access to follow-up", "time pressure"] },
        { text: "I changed my diet but found the test price a barrier.", sentiment: "neutral", themes: ["cost"] },
      ],
    },
  },
  {
    name: "Childhood Vaccination Community Briefing",
    seriesKey: "vaccination-briefing",
    facilitatorName: "Dr. A. Fatima",
    synopsis: "A short community briefing for parents on the childhood immunisation schedule, common side effects and myths, followed by on-site vaccination.",
    objectives: [
      "Parents know the vaccines their child needs and when.",
      "Parents can tell normal side effects from signs that need a doctor.",
      "Parents feel confident that vaccines are safe.",
      "Parents book or complete their child's next due vaccine.",
    ],
    expectedOutcomes: [
      "Within 30 days, most families complete the next due vaccine.",
      "Fewer parents report fear or myths about side effects.",
    ],
    obj4YesNo: true,
    sessionQuestions: [
      { role: "obj1", type: "star_1_5", category: "Communication", text: `${AGREE}I know which vaccines my child needs and when.` },
      { role: "obj2", type: "star_1_5", category: "Communication", text: `${AGREE}I can tell normal side effects from signs that need a doctor.` },
      { role: "obj3", type: "star_1_5", category: "Product Quality", text: `${AGREE}I feel confident that the vaccines are safe for my child.` },
      { role: "obj4", type: "yes_no", category: "Service Speed", text: "Did your child receive or get booked for the next due vaccine today?" },
      facilitator(),
      { role: "nps", type: "nps_0_10", text: "How likely are you to recommend this briefing to other parents?" },
      { role: "favourite", type: "multiple_choice", text: "Which part helped most?", options: ["The vaccine schedule card", "Myths and facts", "Meeting the paediatrician", "On-site vaccination"] },
      { role: "open", type: "open_text", text: "What worry do you still have about vaccination?" },
    ],
    favouriteWeights: [3.2, 3.6, 2.4, 2.8],
    comments: [
      { text: "The schedule card is now on our fridge. I finally know what is due and when.", sentiment: "positive", themes: ["schedule card"] },
      { text: "The doctor answered the rumours I heard on WhatsApp calmly and with facts.", sentiment: "positive", themes: ["myths and facts", "facilitator"] },
      { text: "My daughter was vaccinated on site and the nurse was gentle.", sentiment: "positive", themes: ["on-site vaccination"] },
      { text: "I feel much less afraid of fever after the injection now that I know what is normal.", sentiment: "positive", themes: ["side effects"] },
      { text: "Informative, but the hall was hot and the babies were restless.", sentiment: "neutral", themes: ["venue comfort"] },
      { text: "I understand the schedule, but I still worry about too many vaccines at once.", sentiment: "neutral", themes: ["confidence in safety"] },
      { text: "I could not tell which side effects mean I should go to a hospital.", sentiment: "negative", themes: ["side effects", "when to seek help"] },
      { text: "Some fathers did not attend. Maybe hold an evening session.", sentiment: "negative", themes: ["timing", "fathers"] },
    ],
    sessions: [
      { location: "Karachi", startsAgo: 40, durationDays: 1, responses: 28, followUps: 10, targets: { obj1: 4.4, obj2: 3.4, obj3: 4.1, obj4: 0.78 }, facilitator: 4.7, promoters: 0.75 },
      {
        location: "Peshawar",
        startsAgo: 18,
        durationDays: 1,
        responses: 24,
        followUps: 0,
        targets: { obj1: 4.2, obj2: 3.0, obj3: 3.0, obj4: 0.5 },
        facilitator: 4.4,
        promoters: 0.55,
        gapComments: [
          { text: "Many mothers here believe the vaccine causes illness. One talk was not enough to change that.", sentiment: "negative", themes: ["confidence in safety", "myths and facts"] },
          { text: "A local religious scholar or elder should speak with the doctor.", sentiment: "negative", themes: ["community trust", "local voices"] },
        ],
      },
      { location: "Quetta", startsAgo: -9, durationDays: 1, responses: 0, followUps: 0, targets: { obj1: 4.3, obj2: 3.5, obj3: 3.6, obj4: 0.6 }, facilitator: 4.5, promoters: 0.6 },
    ],
    followUp: {
      questions: [
        { role: "obj1", type: "yes_no", category: "Service Speed", text: "Has your child had the next due vaccine since the briefing?" },
        { role: "obj2", type: "multiple_choice", category: "Communication", text: "How do you feel about vaccines now?", options: ["More confident", "About the same", "Still worried", "Not sure"] },
        { role: "obj4", type: "yes_no", category: "Communication", text: "Have you spoken to other parents about what you learned?" },
        { role: "open", type: "open_text", text: "What helped or got in the way of completing the schedule?" },
      ],
      yesRates: [0.7, 0.75],
      choiceWeights: [4, 2.4, 1.6, 1],
      comments: [
        { text: "We completed the next dose on time and kept the card updated.", sentiment: "positive", themes: ["schedule adherence"] },
        { text: "I convinced my sister to vaccinate her baby after sharing the myths and facts.", sentiment: "positive", themes: ["peer influence"] },
        { text: "The vaccination centre closes before my husband returns from work.", sentiment: "negative", themes: ["timing", "access"] },
        { text: "Waited long at the centre with a crying baby.", sentiment: "neutral", themes: ["waiting time"] },
      ],
    },
  },
  {
    name: "Healthy Mothers Education Workshop",
    seriesKey: "healthy-mothers",
    facilitatorName: "Dr. N. Qureshi",
    synopsis: "A two-hour workshop for expectant and new mothers on antenatal checks, nutrition, warning signs and where to get care.",
    objectives: [
      "Mothers know which antenatal checks and tests they need and when.",
      "Mothers can name pregnancy warning signs that need urgent care.",
      "Mothers know simple nutrition and hygiene practices for themselves and their baby.",
      "Mothers feel comfortable asking a doctor or nurse questions.",
    ],
    expectedOutcomes: [
      "Within 30 days, most attendees schedule or complete an antenatal check.",
      "Mothers report asking more questions at their next visit.",
    ],
    sessionQuestions: [
      { role: "obj1", type: "star_1_5", category: "Communication", text: `${AGREE}I know which antenatal checks and tests I need and when.` },
      { role: "obj2", type: "star_1_5", category: "Communication", text: `${AGREE}I can name pregnancy warning signs that need urgent care.` },
      { role: "obj3", type: "star_1_5", category: "Product Quality", text: `${AGREE}I know simple nutrition and hygiene practices for me and my baby.` },
      { role: "obj4", type: "star_1_5", category: "Staff Friendliness", text: `${AGREE}I feel comfortable asking a doctor or nurse my questions.` },
      facilitator(),
      { role: "nps", type: "nps_0_10", text: "How likely are you to recommend this workshop to another mother?" },
      { role: "favourite", type: "multiple_choice", text: "Which part helped you most?", options: ["Antenatal check list", "Warning signs", "Nutrition and hygiene", "Asking the doctor questions"] },
      { role: "open", type: "open_text", text: "What will you do differently in the next month?" },
    ],
    favouriteWeights: [3.4, 3.2, 2.6, 2.4],
    comments: [
      { text: "The warning signs list is something I will keep. I did not know about swelling and headaches.", sentiment: "positive", themes: ["warning signs"] },
      { text: "The doctor made it easy to ask questions I was shy about.", sentiment: "positive", themes: ["comfortable asking questions", "facilitator"] },
      { text: "The nutrition tips were practical and used food we already eat.", sentiment: "positive", themes: ["nutrition", "practical advice"] },
      { text: "I booked my next antenatal check straight after the session.", sentiment: "positive", themes: ["antenatal checks"] },
      { text: "It was helpful, but two hours was too short for all the questions.", sentiment: "neutral", themes: ["session length"] },
      { text: "I wish my mother-in-law could have attended too, since she decides a lot.", sentiment: "neutral", themes: ["family involvement"] },
      { text: "I still do not understand which tests I need in each trimester.", sentiment: "negative", themes: ["antenatal checks", "clarity"] },
      { text: "The room had no space for women with small children.", sentiment: "negative", themes: ["venue", "childcare"] },
    ],
    sessions: [
      { location: "Islamabad", startsAgo: 44, durationDays: 1, responses: 27, followUps: 10, targets: { obj1: 4.0, obj2: 4.4, obj3: 4.2, obj4: 4.5 }, facilitator: 4.7, promoters: 0.76 },
      {
        location: "Rawalpindi",
        startsAgo: 20,
        durationDays: 1,
        responses: 24,
        followUps: 0,
        targets: { obj1: 3.0, obj2: 4.2, obj3: 4.0, obj4: 4.3 },
        facilitator: 4.5,
        promoters: 0.66,
        gapComments: [
          { text: "I left still unsure about the tests for each trimester. A printed schedule would help.", sentiment: "negative", themes: ["antenatal checks", "clarity"] },
          { text: "We covered warning signs well but not the timing of scans and blood tests.", sentiment: "negative", themes: ["antenatal checks", "timing of tests"] },
        ],
      },
      { location: "Lahore", startsAgo: -5, durationDays: 1, responses: 0, followUps: 0, targets: { obj1: 3.6, obj2: 4.2, obj3: 4.0, obj4: 4.3 }, facilitator: 4.6, promoters: 0.65 },
    ],
    followUp: {
      questions: [
        { role: "obj1", type: "yes_no", category: "Service Speed", text: "Have you had an antenatal check or test since the workshop?" },
        { role: "obj4", type: "multiple_choice", category: "Staff Friendliness", text: "At your last visit, how did you feel about asking questions?", options: ["Very comfortable", "Somewhat comfortable", "Still hesitant", "Did not ask"] },
        { role: "obj3", type: "yes_no", category: "Product Quality", text: "Have you made any change to your diet or hygiene since the workshop?" },
        { role: "open", type: "open_text", text: "What helped or got in the way of acting on what you learned?" },
      ],
      yesRates: [0.8, 0.72],
      choiceWeights: [3.4, 3, 1.6, 1],
      comments: [
        { text: "I asked about my swelling at the next visit and the doctor took it seriously.", sentiment: "positive", themes: ["comfortable asking questions"] },
        { text: "I now follow the schedule card and have not missed a check.", sentiment: "positive", themes: ["antenatal checks"] },
        { text: "Transport to the centre is the hardest part for me.", sentiment: "negative", themes: ["access", "transport"] },
        { text: "Food prices make the nutrition advice hard to follow every day.", sentiment: "neutral", themes: ["cost", "nutrition"] },
      ],
    },
  },
];
