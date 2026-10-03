import mongoose from "mongoose";
import { Category } from "./models/Category";
import { CxPulseScore } from "./models/CxPulseScore";

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
  return connection;
}

export async function disconnectFromDatabase(): Promise<void> {
  connectPromise = null;
  await mongoose.disconnect();
}

export { mongoose };
