import mongoose, { Schema, model, type Model } from "mongoose";

/** One row per scheduled job: when it last ran and whether that run worked. Shown in Admin -> Platform Health. */
export interface ICronRun {
  job: string;
  lastRunAt: Date;
  lastOk: boolean;
  lastMessage: string;
}

const CronRunSchema = new Schema<ICronRun>(
  {
    job: { type: String, required: true, unique: true },
    lastRunAt: { type: Date, required: true },
    lastOk: { type: Boolean, required: true },
    lastMessage: { type: String, default: "" },
  },
  { timestamps: false }
);

export const CronRun: Model<ICronRun> = mongoose.models.CronRun ?? model<ICronRun>("CronRun", CronRunSchema);

/** Never throws: recording a run must not break the job itself. */
export async function recordCronRun(job: string, ok: boolean, message = ""): Promise<void> {
  try {
    await CronRun.updateOne({ job }, { $set: { lastRunAt: new Date(), lastOk: ok, lastMessage: message.slice(0, 300) } }, { upsert: true });
  } catch (err) {
    console.error("[cron] could not record run", job, err);
  }
}

/** Every scheduled job, how often it should run, and what stops working if it does not. */
export const CRON_JOBS: { job: string; every: string; maxAgeHours: number; why: string }[] = [
  { job: "auto-escalate-cases", every: "hourly", maxAgeHours: 3, why: "Overdue cases move up the escalation chain on their own." },
  { job: "recompute-cx-pulse", every: "daily", maxAgeHours: 30, why: "CX Pulse scores stay current." },
  { job: "measure-decisions", every: "daily", maxAgeHours: 30, why: "Decision Log before/after results are measured." },
  { job: "evaluate-baseline-alerts", every: "daily", maxAgeHours: 30, why: "Sudden-drop and outlier alerts fire." },
  { job: "generate-insights", every: "weekly", maxAgeHours: 24 * 8, why: "AI Insights reports are drafted for approval." },
  { job: "program-evaluation", every: "daily", maxAgeHours: 30, why: "Program Evaluation compares training aims with feedback." },
  { job: "comp-expiry-reminders", every: "daily", maxAgeHours: 30, why: "Complimentary and pilot accounts get expiry reminders." },
  { job: "ce-pulse-cadence", every: "daily", maxAgeHours: 30, why: "Retired staff pulse scheduling (no effect for launch)." },
  { job: "ce-lifecycle-triggers", every: "daily", maxAgeHours: 30, why: "Retired staff lifecycle surveys (no effect for launch)." },
];
