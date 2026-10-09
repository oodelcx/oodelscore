import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/adminAuth";
import { getDevJob, startDevJob } from "@/lib/devJob";

async function guard() {
  if (process.env.ENABLE_DEV_DATA_TOOLS !== "true") {
    return NextResponse.json({ status: "error", message: "Dev Data Tools are not enabled in this environment" }, { status: 403 });
  }
  const session = await requireStaffSession();
  if (!session || session.role.name !== "Admin") return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  return null;
}

/** Progress of the background wipe-and-reseed. Polling this also keeps a free instance awake. */
export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json({ status: "ok", job: getDevJob() });
}

/** Starts the full reset (wipe, then seed everything) or a seed-only run. Returns at once; the work continues on the server. */
export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const mode = body?.mode === "seed" ? "seed" : "reseed";
  if (mode === "reseed" && body?.confirm !== "DELETE ALL DATA") {
    return NextResponse.json({ status: "error", message: 'Type "DELETE ALL DATA" exactly to confirm.' }, { status: 400 });
  }
  if (!startDevJob(mode)) return NextResponse.json({ status: "error", message: "A reset is already running.", job: getDevJob() }, { status: 409 });
  return NextResponse.json({ status: "ok", job: getDevJob() }, { status: 202 });
}
