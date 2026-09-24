/**
 * Colleague Experience's minimum-group-size floor. Industry standard (Culture
 * Amp, Gallup, Glint all use this exact number): with 5 responses, even in
 * the worst case (one clearly negative answer among the five), there are
 * still 4 other plausible authors — nobody can point at a specific person
 * with confidence. This is a floor, never a UI-only hint: every screen that
 * would show a Colleague Experience score, comment, or demographic cross-tab
 * for a group below this size must show nothing for that slice instead —
 * not a blurred number, not "1 person said something," genuinely nothing —
 * until enough responses exist. See meetsAnonymityFloor() below.
 *
 * This does NOT gate a single, content-flagged actionable comment (e.g. "no
 * wheelchair access") — that's a separate, deliberately different path: a
 * concrete, checkable claim about the workplace is actionable at n=1
 * because acting on it never requires knowing who said it. This floor only
 * governs aggregate reporting (a score, a routine comment listing, a
 * demographic cross-tab), where the group size itself is what protects
 * anonymity.
 */
export const MIN_ANONYMITY_GROUP_SIZE = 5;

/** True once a slice (a branch, a category, a demographic cross-tab) has enough responses to display safely. */
export function meetsAnonymityFloor(responseCount: number): boolean {
  return responseCount >= MIN_ANONYMITY_GROUP_SIZE;
}
