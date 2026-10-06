import mongoose from "mongoose";
import { Category } from "./models/Category";
import { CxPulseScore } from "./models/CxPulseScore";
import { SiteContent } from "./models/SiteContent";
import { COPY_V2 } from "./seedData/siteCopy";

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

// Seed wording that changed with the site redesign (QR-or-link, product
// renames). Each entry only rewrites a field whose stored value is *exactly*
// the old default, so anything an admin has edited is left alone.
const COPY_UPDATES: { page: string; key: string; from: string; to: string; partial?: boolean }[] = [
  { page: "customer-x", key: "heroHeadline", from: "Customer X: everything from a QR scan to a resolved decision.", to: "Everything from a QR code or link to a resolved decision." },
  { page: "colleague-x", key: "heroHeadline", from: "Colleague X: the same rigor, pointed at your own team.", to: "The same rigor, pointed at your own team." },
  { page: "customer-x", key: "finalCtaSecondaryButton", from: "Sign in", to: "See pricing" },
  { page: "colleague-x", key: "finalCtaSecondaryButton", from: "Sign in", to: "See pricing" },
  { page: "home", key: "finalCtaSecondaryButton", from: "Sign in", to: "See pricing" },
  { page: "home", key: "heroTwoProductsCxLabel", from: "Customer X", to: "For customers, clients, patients" },
  { page: "home", key: "heroTwoProductsCeLabel", from: "Colleague X", to: "For your own people" },
  { page: "home", key: "heroSubheadline", from: "OodelCX turns every QR scan — from a customer or a colleague — into tracked, owned work, not another number on a dashboard nobody opens. Built for one location or a thousand.", to: "OodelCX turns every response — a QR scan or a shared link, from a customer or a colleague — into tracked, owned work, not another number on a dashboard nobody opens. Built for one location or a thousand." },
  { page: "home", key: "loopStages", from: "A QR scan, a short survey, no app or login.", to: "A QR code or a link, a short survey, no app or login.", partial: true },
  { page: "pricing", key: "heroSubhead", from: "Customer Experience and Colleague Pulse are priced and billed separately", to: "Customer X and Colleague X are priced and billed separately", partial: true },
  { page: "pricing", key: "metaDescription", from: "OodelCX pricing for Customer Experience and Colleague Pulse", to: "OodelCX pricing for Customer X and Colleague X", partial: true },
  { page: "pricing", key: "cePlansSubhead", from: "Already running Customer Experience? Adding Colleague Pulse", to: "Already running Customer X? Adding Colleague X", partial: true },
  { page: "pricing", key: "cxPlansHeading", from: "Customer Experience", to: "Customer X" },
  { page: "pricing", key: "cePlansHeading", from: "Colleague Pulse", to: "Colleague X" },
  { page: "pricing", key: "loopStripItems", from: "Unlimited QR feedback points and responses", to: "Unlimited feedback points (QR or link) and responses", partial: true },
];

async function applyRedesignMigrations(): Promise<void> {
  const col = SiteContent.collection;
  for (const u of COPY_UPDATES) {
    const doc = await col.findOne({ page: u.page });
    const value = (doc?.fields as Record<string, string> | undefined)?.[u.key];
    if (!doc || typeof value !== "string") continue;
    if (u.partial ? value.includes(u.from) : value === u.from) {
      await col.updateOne({ _id: doc._id }, { $set: { [`fields.${u.key}`]: u.partial ? value.split(u.from).join(u.to) : u.to } });
    }
  }
  await applyCopyV2Migration(col);
  // The redesigned nav has no How it works / Contact entries (the loop lives on
  // Home, the demo form on Company). Hide them once, then leave the admin's
  // choice alone.
  const menu = await col.findOne({ page: "menu" });
  const fields = (menu?.fields ?? {}) as Record<string, string>;
  if (menu && fields.navV2 !== "1" && Array.isArray(menu.navItems)) {
    const navItems = menu.navItems.map((item: Record<string, unknown>) =>
      item.key === "how-it-works" || item.key === "contact" ? { ...item, visible: false } : item
    );
    await col.updateOne({ _id: menu._id }, { $set: { navItems, "fields.navV2": "1" } });
  }
}

// One-time rewrite of the marketing copy (see seedData/siteCopy.ts). Each page
// is stamped with `fields.copyV2` so later admin edits are never overwritten.
async function applyCopyV2Migration(col: typeof SiteContent.collection): Promise<void> {
  for (const [page, copy] of Object.entries(COPY_V2)) {
    const doc = await col.findOne({ page });
    if (!doc) continue;
    const fields = (doc.fields ?? {}) as Record<string, string>;
    if (fields.copyV2 === "1") continue;
    const $set: Record<string, string> = { "fields.copyV2": "1" };
    for (const [key, value] of Object.entries(copy)) $set[`fields.${key}`] = value;
    await col.updateOne({ _id: doc._id }, { $set });
  }
}

function runLegacyMigration(): Promise<void> {
  if (!legacyKeyMigrationPromise) {
    legacyKeyMigrationPromise = migrateLegacySiteContentKeys().then(applyRedesignMigrations).catch((err) => {
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
