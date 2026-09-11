import type { ICxPulseDimensions } from "../models/CxPulseScore";

// Default weights per spec Section 7 (sum to 100).
export const DEFAULT_CX_PULSE_WEIGHTS: ICxPulseDimensions = {
  awareness: 20,
  response: 25,
  ownership: 20,
  culture: 15,
  outcome: 20,
};

// Starting set of quarterly self-assessment questions sent to account
// holders — editable from Admin's Framework Settings page.
export const DEFAULT_CX_PULSE_QUESTIONS: string[] = [
  "How often does your team review customer feedback?",
  "Who on your team owns acting on flagged feedback?",
  "What's changed in how you operate as a result of feedback in the last quarter?",
  "How confident are you that recent changes improved customer experience?",
];
