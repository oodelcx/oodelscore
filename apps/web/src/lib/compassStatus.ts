import { hasFeature, type ICompassAssessment } from "@oodelscore/shared";

export type CompassStatus = "off" | "not_started" | "in_progress" | "established" | "emerging";

/**
 * Compass adoption status for one account, for Admin's Businesses/Parent
 * Orgs list badges — not the live scoring engine (that's
 * computeCompassResult()), just a label of where the account stands.
 */
export function compassStatusFor(
  enabledFeatures: readonly string[] | undefined | null,
  assessment: Pick<ICompassAssessment, "status" | "stage"> | undefined | null
): CompassStatus {
  if (!hasFeature(enabledFeatures, "compass")) return "off";
  if (!assessment) return "not_started";
  if (assessment.status !== "completed") return "in_progress";
  return assessment.stage === "established" ? "established" : "emerging";
}

export const COMPASS_STATUS_LABEL: Record<CompassStatus, string> = {
  off: "Off",
  not_started: "Not started",
  in_progress: "In progress",
  established: "Established",
  emerging: "Emerging",
};
