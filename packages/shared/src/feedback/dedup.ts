/**
 * One feedback submission per person per feedback point per 24h.
 *
 * Primary check: a cookie set on successful submit, scoped to this one
 * feedback point, whose own 24h expiry IS the dedup window (its mere
 * presence means "already submitted recently") — catches the common case
 * (an accidental double-scan, or someone resubmitting for fun) without
 * needing any personal information.
 *
 * Secondary check (device-independent): if the respondent gave an email or
 * phone number, the submit route also rejects a repeat within the same
 * window keyed on that contact info, so switching browsers/devices with
 * the same contact details doesn't bypass the cookie.
 *
 * Neither check is airtight against a determined bad actor (clearing
 * cookies and using a fresh, fake email each time defeats both) — that
 * matches how most feedback-collection tools handle this; the goal is
 * blocking accidental/casual repeats and someone gaming a single
 * business's score, not fraud-proofing an incentivized survey.
 */

export const DEDUP_WINDOW_SECONDS = 24 * 60 * 60;

export function dedupCookieName(feedbackPointId: string): string {
  return `oodel_fb_${feedbackPointId}`;
}
