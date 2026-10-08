/** At most this many cases are opened automatically per location per day; the rest wait as responses a person can turn into a case. */
export const AUTO_CASE_DAILY_CAP = 5;

const SEVERE_STAR_AVERAGE = 1.5;
const SEVERE_NPS_MAX = 2;

interface AnswerLike {
  type: string;
  value: unknown;
}

/**
 * Why a single response is severe enough to open a case on its own, or null when it is not.
 * Severe means: the average of its star answers is 1.5 or lower, or its 0-10 recommend score is 0 to 2.
 */
export function severeResponseReason(answers: AnswerLike[]): string | null {
  const stars = answers.filter((a) => a.type === "star_1_5" && typeof a.value === "number").map((a) => a.value as number);
  if (stars.length > 0) {
    const avg = stars.reduce((sum, v) => sum + v, 0) / stars.length;
    if (avg <= SEVERE_STAR_AVERAGE) return `star rating of ${Math.round(avg * 10) / 10} out of 5`;
  }
  const nps = answers.find((a) => a.type === "nps_0_10" && typeof a.value === "number");
  if (nps && (nps.value as number) <= SEVERE_NPS_MAX) return `recommend score of ${nps.value} out of 10`;
  return null;
}
