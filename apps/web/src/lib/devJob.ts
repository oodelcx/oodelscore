import {
  connectToDatabase,
  wipeAllTenantData,
  seedPlatformDefaults,
  seedShowcaseData,
  generateDueInsights,
  ALL_AI_REPORT_PERIODS,
  recomputeAllCxPulseScores,
  AiInsightReport,
} from "@oodelscore/shared";

/**
 * A full wipe-and-reseed that runs in the background of the server process, so the browser (and Render's
 * request timeout) never has to wait for it. The page starts it, then polls the status. State lives in memory:
 * if the instance restarts mid-run the status simply reads "idle" and the job is started again. Every seed step
 * is find-or-create, so a restarted run is safe.
 */
export interface DevJobState {
  state: "idle" | "running" | "done" | "error";
  mode: "reseed" | "seed" | null;
  startedAt: number | null;
  finishedAt: number | null;
  step: string;
  log: string[];
  error: string | null;
  summary: string | null;
}

const g = globalThis as unknown as { __devJob?: DevJobState };
const job: DevJobState = (g.__devJob ??= { state: "idle", mode: null, startedAt: null, finishedAt: null, step: "", log: [], error: null, summary: null });

export function getDevJob(): DevJobState {
  return job;
}

function note(step: string) {
  job.step = step;
  job.log.push(`${new Date().toISOString().slice(11, 19)}  ${step}`);
  if (job.log.length > 200) job.log.shift();
}

export function startDevJob(mode: "reseed" | "seed"): boolean {
  if (job.state === "running") return false;
  Object.assign(job, { state: "running", mode, startedAt: Date.now(), finishedAt: null, step: "Starting", log: [], error: null, summary: null });
  void run(mode);
  return true;
}

async function run(mode: "reseed" | "seed") {
  // The seed already narrates its own progress with "[showcase] ..." lines; surface them as the live step.
  const original = console.log;
  console.log = (...args: unknown[]) => {
    original(...args);
    const first = typeof args[0] === "string" ? args[0] : "";
    if (first.startsWith("[showcase]")) note(first.replace("[showcase] ", "").slice(0, 140));
  };
  process.env.SHOWCASE_RESPONSE_SCALE ??= "5";
  process.env.SHOWCASE_HISTORY_DAYS ??= "660";
  try {
    await connectToDatabase();
    if (mode === "reseed") {
      note("Wiping existing data");
      const wiped = await wipeAllTenantData();
      note(`Wiped ${Object.values(wiped).reduce((a, b) => a + b, 0)} records`);
    }
    note("Ensuring platform defaults");
    await seedPlatformDefaults();
    note("Seeding showcase data (the long step)");
    const result = await seedShowcaseData();
    note("Generating AI Insight Reports");
    const insights = await generateDueInsights(new Date(), [...ALL_AI_REPORT_PERIODS]);
    await AiInsightReport.updateMany({ status: "pending" }, { $set: { status: "approved", reviewedAt: new Date() } });
    note("Computing CX Pulse scores");
    await recomputeAllCxPulseScores();
    job.summary = `${result.parentOrgs} organizations, ${result.businesses} businesses, ${result.users} logins, ${result.responses} responses, ${result.actionBoardItems} cases, ${insights.reportsCreated} insight reports.`;
    job.state = "done";
    note("Finished");
  } catch (err) {
    job.state = "error";
    job.error = err instanceof Error ? err.message : String(err);
    note(`Failed: ${job.error}`);
    console.error("[dev-job] reseed failed", err);
  } finally {
    console.log = original;
    job.finishedAt = Date.now();
  }
}
