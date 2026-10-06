import mongoose from "mongoose";
import { Category } from "./models/Category";
import { CxPulseScore } from "./models/CxPulseScore";
import { SiteContent } from "./models/SiteContent";

let connectPromise: Promise<typeof mongoose> | null = null;
let staleIndexSyncPromise: Promise<void> | null = null;

// Category and CxPulseScore both replaced an older, narrower unique index
// with a wider one when Colleague Experience shipped (see the NOTE comment
// on each model) — Mongoose only ever creates missing indexes, it never
// drops a stale one, so any database that existed before that change keeps
// enforcing the old index alongside the new one. For CxPulseScore that's
// not just "too strict": the old 3-field index (no `product`) rejects the
// second product's row for the same owner/period outright, so it isn't a
// migration nicety, it's a write-time crash on any dual-product account
// until synced. Doing it once here, on first real connection in each
// process, means every environment (including one nobody remembered to
// run a manual migration against) self-heals the moment it starts serving
// traffic, instead of only the environment someone happened to run
// Category.syncIndexes() against by hand.
function syncStaleIndexes(): Promise<void> {
  if (!staleIndexSyncPromise) {
    staleIndexSyncPromise = Promise.all([Category.syncIndexes(), CxPulseScore.syncIndexes()])
      .then(() => undefined)
      .catch((err) => {
        staleIndexSyncPromise = null;
        throw err;
      });
  }
  return staleIndexSyncPromise;
}

const LEGACY_PAGE_KEYS: Record<string, string> = { product: "customer-x", "colleague-pulse": "colleague-x" };
const LEGACY_LABELS: Record<string, string> = {
  "Customer Experience": "Customer X",
  Product: "Customer X",
  "Colleague Pulse": "Colleague X",
  "Colleague Experience": "Colleague X",
};

let legacyKeyMigrationPromise: Promise<void> | null = null;

// The pages were renamed product -> customer-x and colleague-pulse ->
// colleague-x, but live SiteContent docs (and the menu doc's navItems) are
// still stored under the old keys, so the nav never matched and the admin
// editor saw nothing. Idempotent: renames in place on first connection.
async function migrateLegacySiteContentKeys(): Promise<void> {
  const col = SiteContent.collection;
  for (const [oldKey, newKey] of Object.entries(LEGACY_PAGE_KEYS)) {
    const legacy = await col.findOne({ page: oldKey });
    if (!legacy) continue;
    await col.deleteMany({ page: newKey });
    await col.updateOne({ _id: legacy._id }, { $set: { page: newKey } });
  }
  const menu = await col.findOne({ page: "menu" });
  if (!menu) return;
  const $set: Record<string, unknown> = {};
  if (Array.isArray(menu.navItems)) {
    const remap = (k: unknown) => LEGACY_PAGE_KEYS[k as string] ?? k;
    const mapped: Record<string, unknown>[] = menu.navItems.map((item: Record<string, unknown>) => {
      const isLegacy = item.key !== remap(item.key);
      return {
        ...item,
        key: remap(item.key),
        label: isLegacy ? (LEGACY_LABELS[item.label as string] ?? item.label) : item.label,
        ...(item.parentKey ? { parentKey: remap(item.parentKey) } : {}),
        ...(Array.isArray(item.children) ? { children: item.children.map(remap) } : {}),
      };
    });
    // A page can end up listed twice (the old entry plus one merged in from
    // the seed and saved) — keep one per key, visible if either was.
    const seen = new Map<string, Record<string, unknown>>();
    const navItems: Record<string, unknown>[] = [];
    for (const item of mapped) {
      const existing = seen.get(item.key as string);
      if (existing) existing.visible = Boolean(existing.visible) || Boolean(item.visible);
      else {
        seen.set(item.key as string, item);
        navItems.push(item);
      }
    }
    if (JSON.stringify(navItems) !== JSON.stringify(menu.navItems)) $set.navItems = navItems;
  }
  const fields = (menu.fields ?? {}) as Record<string, string>;
  const rename = (v: string) => v.replace(/Customer Experience/g, "Customer X").replace(/Colleague Pulse(?! Score)/g, "Colleague X");
  for (const key of ["footerDescription", "footerProductHeading", "footerProductLinks"]) {
    if (typeof fields[key] === "string" && rename(fields[key]) !== fields[key]) $set[`fields.${key}`] = rename(fields[key]);
  }
  if (Object.keys($set).length) await col.updateOne({ _id: menu._id }, { $set });
}

function runLegacyMigration(): Promise<void> {
  if (!legacyKeyMigrationPromise) {
    legacyKeyMigrationPromise = migrateLegacySiteContentKeys().catch((err) => {
      legacyKeyMigrationPromise = null;
      throw err;
    });
  }
  return legacyKeyMigrationPromise;
}

/**
 * Reuses a single connection across hot reloads / serverless invocations
 * instead of opening a new one per call.
 */
export async function connectToDatabase(uri: string = process.env.MONGODB_URI ?? ""): Promise<typeof mongoose> {
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (mongoose.connection.readyState === 1) {
    await syncStaleIndexes();
    await runLegacyMigration();
    return mongoose;
  }

  if (!connectPromise) {
    connectPromise = mongoose.connect(uri).catch((err) => {
      connectPromise = null;
      throw err;
    });
  }

  const connection = await connectPromise;
  await syncStaleIndexes();
  await runLegacyMigration();
  return connection;
}

export async function disconnectFromDatabase(): Promise<void> {
  connectPromise = null;
  await mongoose.disconnect();
}

export { mongoose };
