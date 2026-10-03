import mongoose, { Schema, model, type Model, type Types } from "mongoose";

/**
 * The Event layer (roadmap: "instance-based" feedback, alongside the
 * original "place-based" FeedbackPoint model). A FeedbackPoint's eventId
 * is nullable and most businesses (hotels, banks, gyms-as-locations) never
 * set it — nothing about their model changes. A business running recurring
 * sessions (training courses, flights, classes) creates one Event per
 * offering, then one FeedbackPoint per instance of it (a specific date,
 * city, facilitator), all pointing at the same Event so Analytics can
 * compare instances instead of only comparing branches.
 *
 * seriesKey groups repeat instances of the same underlying offering (e.g.
 * "Excel Fundamentals" run in Nairobi, then Lagos, then Accra all share one
 * seriesKey) — this is what an eventual "compare across all runs of this
 * course" view filters on, distinct from comparing one specific instance.
 */
// "training" is the only category Program Evaluation (see
// ../scoring/programEvaluation.ts) ever acts on — a musical event, a trade
// show booth, or anything else stays "other" and is invisible to that
// feature even if the business has it turned on. Defaults to "other" so
// no event created before this field existed is retroactively treated as
// a training program.
export const EVENT_CATEGORIES = ["training", "other"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface IEventProgramDetails {
  synopsis: string;
  objectives: string[];
  expectedOutcomes: string[];
}

export interface IEvent {
  businessId: Types.ObjectId;
  name: string; // the offering itself, e.g. "Excel Fundamentals" — not the instance
  seriesKey: string; // groups repeat instances of the same offering; defaults to a slug of `name`
  facilitator: string; // trainer / crew / instructor for this instance — optional, business-defined
  location: string; // city / venue for this instance
  startsAt: Date | null;
  endsAt: Date | null; // once passed, linked FeedbackPoints are treated as closed even if `active` is still true
  expectedAttendees: number | null; // lets Analytics show response rate per session, not just raw count
  category: EventCategory;
  // Only meaningful when category is "training" — what Program Evaluation
  // compares the actual feedback against. Entered by the business itself
  // (unlike the rest of this model, which stays Admin-managed) since it's
  // the business's own program content, not survey/question structure —
  // see PATCH /api/business/events/[id].
  programDetails: IEventProgramDetails | null;
  createdAt: Date;
  updatedAt: Date;
}

const EventProgramDetailsSchema = new Schema<IEventProgramDetails>(
  {
    synopsis: { type: String, default: "" },
    objectives: { type: [String], default: [] },
    expectedOutcomes: { type: [String], default: [] },
  },
  { _id: false }
);

const EventSchema = new Schema<IEvent>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true },
    seriesKey: { type: String, required: true, trim: true },
    facilitator: { type: String, default: "" },
    location: { type: String, default: "" },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    expectedAttendees: { type: Number, default: null },
    category: { type: String, enum: EVENT_CATEGORIES, default: "other" },
    programDetails: { type: EventProgramDetailsSchema, default: null },
  },
  { timestamps: true }
);

// businessId is filtered on every Events listing; seriesKey powers the
// "compare across every run of this course" grouping in Analytics.
EventSchema.index({ businessId: 1 });
EventSchema.index({ businessId: 1, seriesKey: 1 });

export const Event: Model<IEvent> = mongoose.models.Event ?? model<IEvent>("Event", EventSchema);
