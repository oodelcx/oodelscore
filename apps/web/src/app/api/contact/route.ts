import { NextResponse } from "next/server";
import { connectToDatabase, ContactMessage, sendTemplatedEmail } from "@oodelscore/shared";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Below this, a submission is almost certainly a script that filled and
// posted the form faster than a human could type into it — see the
// honeypot comment below for why this exists instead of a visible captcha.
const MIN_HUMAN_FILL_TIME_MS = 2000;

/**
 * Public: the /contact page's form. No visible puzzle/checkbox challenge —
 * that's the "modern" part of "modern captcha": well-built low-friction
 * forms increasingly rely on invisible heuristics instead of making every
 * visitor prove they're human. Two layers, both self-contained (no
 * external account/API key, unlike Cloudflare Turnstile/hCaptcha/reCAPTCHA):
 *
 *  1. Honeypot ("website"): a field real users never see or fill (hidden
 *     off-screen in the page, not display:none/type=hidden, which some
 *     bots skip). A filled-in honeypot means a bot filled every field on
 *     the page, so the submission is dropped.
 *  2. Minimum time-to-submit: the client records when the form mounted and
 *     submits it as `formStartedAt`; a submission that arrives fewer than
 *     MIN_HUMAN_FILL_TIME_MS after that is instant enough to be a bot, not
 *     a human filling in four fields.
 *
 * Both cases return the exact same 201 "ok" response a real submission
 * gets — a bot (or whoever wrote it) is never told it was caught, since
 * that's exactly the signal it would need to adapt around this check.
 *
 * If a visible checkbox-style captcha is wanted later, Cloudflare Turnstile
 * is the standard modern choice (free, one JS snippet) — it just requires
 * signing up for a free Cloudflare account to get a site key, which isn't
 * available in this environment.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const company = typeof body?.company === "string" ? body.company.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const honeypot = typeof body?.website === "string" ? body.website.trim() : "";
  const formStartedAt = typeof body?.formStartedAt === "number" ? body.formStartedAt : null;

  const looksLikeBot = honeypot.length > 0 || (formStartedAt !== null && Date.now() - formStartedAt < MIN_HUMAN_FILL_TIME_MS);
  if (looksLikeBot) {
    // Never tell the caller it was caught — respond exactly like a real
    // success, but don't persist or notify anything.
    return NextResponse.json({ status: "ok" }, { status: 201 });
  }

  if (!name) return NextResponse.json({ status: "error", message: "Name is required" }, { status: 400 });
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ status: "error", message: "A valid email is required" }, { status: 400 });
  }
  if (!message) return NextResponse.json({ status: "error", message: "Message is required" }, { status: 400 });

  await connectToDatabase();
  await ContactMessage.create({ name, email, company, message });

  const notifyTo = process.env.CONTACT_FORM_NOTIFY_EMAIL ?? "hello@oodelscore.com";
  await sendTemplatedEmail("contact_form_submission", notifyTo, {
    sender_name: name,
    sender_email: email,
    sender_company: company || "(no company given)",
    sender_message: message,
  }).catch((err) => console.error("[contact] notification email failed", err));

  return NextResponse.json({ status: "ok" }, { status: 201 });
}
