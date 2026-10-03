import { Role } from "../models/Role";
import { EmailTemplate } from "../models/EmailTemplate";
import { SiteContent } from "../models/SiteContent";
import { CxPulseFramework, CX_PULSE_FRAMEWORK_SINGLETON_KEY } from "../models/CxPulseFramework";
import { CompassQuestion } from "../models/CompassQuestion";
import { SYSTEM_ROLES } from "./roles";
import { SEED_EMAIL_TEMPLATES } from "./emailTemplates";
import { SEED_SITE_CONTENT } from "./siteContent";
import { DEFAULT_CX_PULSE_WEIGHTS, DEFAULT_CX_PULSE_QUESTIONS, DEFAULT_CE_SELF_ASSESSMENT_QUESTIONS } from "./cxPulseFramework";
import { DEFAULT_COMPASS_QUESTIONS } from "./compassQuestions";

export interface PlatformDefaultsSeedResult {
  roles: string[];
  emailTemplates: string[];
  siteContentPages: string[];
}

/**
 * Idempotent — safe to call repeatedly, including on every app boot. Seeds
 * only the platform-wide defaults called out in the spec: the 3 system
 * roles, the 9 default email templates, and the singleton CX Pulse
 * framework config. Does not touch any tenant data.
 *
 * Assumes the caller has already called connectToDatabase(); does not
 * connect or disconnect itself, since callers may be a short-lived CLI
 * script or a long-running server process reusing an existing connection.
 */
export async function seedPlatformDefaults(): Promise<PlatformDefaultsSeedResult> {
  for (const role of SYSTEM_ROLES) {
    await Role.updateOne({ name: role.name }, { $setOnInsert: role }, { upsert: true });
  }

  for (const template of SEED_EMAIL_TEMPLATES) {
    await EmailTemplate.updateOne({ key: template.key }, { $setOnInsert: template }, { upsert: true });
  }

  await CxPulseFramework.updateOne(
    { singletonKey: CX_PULSE_FRAMEWORK_SINGLETON_KEY },
    {
      $setOnInsert: {
        singletonKey: CX_PULSE_FRAMEWORK_SINGLETON_KEY,
        weights: DEFAULT_CX_PULSE_WEIGHTS,
        pulseQuestions: DEFAULT_CX_PULSE_QUESTIONS,
        ceSelfAssessmentQuestions: DEFAULT_CE_SELF_ASSESSMENT_QUESTIONS,
      },
    },
    { upsert: true }
  );

  for (const content of SEED_SITE_CONTENT) {
    await SiteContent.updateOne({ page: content.page }, { $setOnInsert: content }, { upsert: true });
  }

  for (const question of DEFAULT_COMPASS_QUESTIONS) {
    await CompassQuestion.updateOne({ key: question.key }, { $setOnInsert: question }, { upsert: true });
  }

  return {
    roles: SYSTEM_ROLES.map((r) => r.name),
    emailTemplates: SEED_EMAIL_TEMPLATES.map((t) => t.key),
    siteContentPages: SEED_SITE_CONTENT.map((c) => c.page),
  };
}
