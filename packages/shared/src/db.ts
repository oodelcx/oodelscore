import mongoose from "mongoose";

let connectPromise: Promise<typeof mongoose> | null = null;

/**
 * Reuses a single connection across hot reloads / serverless invocations
 * instead of opening a new one per call.
 */
export function connectToDatabase(uri: string = process.env.MONGODB_URI ?? ""): Promise<typeof mongoose> {
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose);
  }

  if (!connectPromise) {
    connectPromise = mongoose.connect(uri).catch((err) => {
      connectPromise = null;
      throw err;
    });
  }

  return connectPromise;
}

export async function disconnectFromDatabase(): Promise<void> {
  connectPromise = null;
  await mongoose.disconnect();
}

export { mongoose };
