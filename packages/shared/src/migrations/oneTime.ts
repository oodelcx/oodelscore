import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { Event } from "../models/Event";
import { PlatformSettings, PLATFORM_SETTINGS_SINGLETON_KEY } from "../models/PlatformSettings";
import { convertTreeToPointers } from "../escalation/convert";
import { ALL_FEATURE_KEYS, DEFAULT_FEATURE_KEYS } from "../features/flags";

/**
 * Program Evaluation became opt-in. Before, an account that Admin never
 * touched had every feature on. This switches it off for every existing
 * account EXCEPT those that actually run trainings or events (they have at
 * least one Event), and always off for a branch (the switch lives on the
 * group). Runs once; the id is recorded in PlatformSettings.
 */
const PROGRAM_EVALUATION_OPT_IN = "program-evaluation-opt-in-v1";

/** Groups set up with the earlier tiers-and-boxes screen move onto "escalates to" pointers. */
const ESCALATION_TREE_TO_POINTERS = "escalation-tree-to-pointers-v1";

export async function runOneTimeMigrations(): Promise<string[]> {
  // The settings row may not exist yet on an account that never saved one; create it with the same defaults the app already assumes.
  const settings = await PlatformSettings.findOneAndUpdate(
    { singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY },
    { $setOnInsert: { singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).select("oneTimeMigrations");
  const done = new Set(settings.oneTimeMigrations ?? []);
  const ran: string[] = [];

  if (!done.has(PROGRAM_EVALUATION_OPT_IN)) {
    const eventBusinessIds = new Set((await Event.distinct("businessId")).map((id) => String(id)));
    const businesses = await Business.find().select("parentOrgId enabledFeatures");
    const orgHasEvents = new Set<string>();
    for (const b of businesses) if (b.parentOrgId && eventBusinessIds.has(b._id.toString())) orgHasEvents.add(b.parentOrgId.toString());

    const fix = (current: string[] | null, keep: boolean): string[] | null | undefined => {
      const has = current ? current.includes("programEvaluation") : true; // null used to mean "all on"
      if (keep) return has && current ? undefined : [...(current ?? DEFAULT_FEATURE_KEYS), "programEvaluation"];
      if (!has) return undefined;
      return (current ?? ALL_FEATURE_KEYS).filter((k) => k !== "programEvaluation");
    };

    for (const b of businesses) {
      const keep = !b.parentOrgId && eventBusinessIds.has(b._id.toString());
      const next = fix(b.enabledFeatures, keep);
      if (next !== undefined) await Business.updateOne({ _id: b._id }, { $set: { enabledFeatures: next } });
    }
    const orgs = await ParentOrganization.find().select("enabledFeatures");
    for (const o of orgs) {
      const next = fix(o.enabledFeatures, orgHasEvents.has(o._id.toString()));
      if (next !== undefined) await ParentOrganization.updateOne({ _id: o._id }, { $set: { enabledFeatures: next } });
    }
    await PlatformSettings.updateOne({ singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY }, { $addToSet: { oneTimeMigrations: PROGRAM_EVALUATION_OPT_IN } });
    ran.push(PROGRAM_EVALUATION_OPT_IN);
  }

  if (!done.has(ESCALATION_TREE_TO_POINTERS)) {
    const orgs = await ParentOrganization.find({ "structure.enabled": true }).select("_id structure");
    for (const o of orgs) if (o.structure.model !== "pointers") await convertTreeToPointers({ parentOrgId: o._id });
    const standalone = await Business.find({ parentOrgId: null, "structure.enabled": true }).select("_id structure");
    for (const b of standalone) if (b.structure.model !== "pointers") await convertTreeToPointers({ businessId: b._id });
    await PlatformSettings.updateOne({ singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY }, { $addToSet: { oneTimeMigrations: ESCALATION_TREE_TO_POINTERS } });
    ran.push(ESCALATION_TREE_TO_POINTERS);
  }
  return ran;
}
