import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { Role } from "../src/models/Role";
import { EmailTemplate } from "../src/models/EmailTemplate";
import { CxPulseFramework, CX_PULSE_FRAMEWORK_SINGLETON_KEY } from "../src/models/CxPulseFramework";
import { SYSTEM_ROLES } from "../src/seedData/roles";
import { SEED_EMAIL_TEMPLATES } from "../src/seedData/emailTemplates";
import { DEFAULT_CX_PULSE_WEIGHTS, DEFAULT_CX_PULSE_QUESTIONS } from "../src/seedData/cxPulseFramework";

/**
 * Idempotent — safe to re-run. Seeds only the platform-wide defaults called
 * out in the spec: the 3 system roles, the 9 default email templates, and
 * the singleton CX Pulse framework config. Does not touch any tenant data.
 */
async function seed(): Promise<void> {
  await connectToDatabase();

  for (const role of SYSTEM_ROLES) {
    await Role.updateOne(
      { name: role.name },
      { $setOnInsert: role },
      { upsert: true }
    );
    console.log(`role ensured: ${role.name}`);
  }

  for (const template of SEED_EMAIL_TEMPLATES) {
    await EmailTemplate.updateOne(
      { key: template.key },
      { $setOnInsert: template },
      { upsert: true }
    );
    console.log(`email template ensured: ${template.key}`);
  }

  await CxPulseFramework.updateOne(
    { singletonKey: CX_PULSE_FRAMEWORK_SINGLETON_KEY },
    {
      $setOnInsert: {
        singletonKey: CX_PULSE_FRAMEWORK_SINGLETON_KEY,
        weights: DEFAULT_CX_PULSE_WEIGHTS,
        pulseQuestions: DEFAULT_CX_PULSE_QUESTIONS,
      },
    },
    { upsert: true }
  );
  console.log("cx pulse framework ensured");

  await disconnectFromDatabase();
  console.log("seed complete");
}

seed().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
