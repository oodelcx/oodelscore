import { Types } from "mongoose";
import { Response } from "../models/Response";

/**
 * Spec Section 2 / bug #1: star (1-5) and NPS (0-10) answers must never be
 * blended into one average. This is the single place that computes both,
 * so every consumer (Alert Rules, AI Insights, CX Pulse) gets it right.
 */
export interface BusinessMetrics {
  responseCount: number;
  starAverage: number | null; // null when there are no star_1_5 answers in range
  npsScore: number | null; // null when there are no nps_0_10 answers in range
}

export async function computeBusinessMetrics(
  businessId: Types.ObjectId | string,
  from: Date,
  to: Date
): Promise<BusinessMetrics> {
  const responses = await Response.find({
    businessId,
    submittedAt: { $gte: from, $lte: to },
  });

  let starSum = 0;
  let starCount = 0;
  const npsAnswers: number[] = [];

  for (const response of responses) {
    for (const answer of response.answers) {
      if (answer.type === "star_1_5" && typeof answer.value === "number") {
        starSum += answer.value;
        starCount += 1;
      } else if (answer.type === "nps_0_10" && typeof answer.value === "number") {
        npsAnswers.push(answer.value);
      }
    }
  }

  const npsScore =
    npsAnswers.length === 0
      ? null
      : (() => {
          const promoters = npsAnswers.filter((v) => v >= 9).length;
          const detractors = npsAnswers.filter((v) => v <= 6).length;
          return Math.round(((promoters - detractors) / npsAnswers.length) * 100);
        })();

  return {
    responseCount: responses.length,
    starAverage: starCount === 0 ? null : Math.round((starSum / starCount) * 100) / 100,
    npsScore,
  };
}
