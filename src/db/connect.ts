import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectToDB = async () => {
  // Already connected (warm serverless invocation)
  if (mongoose.connection?.readyState === 1) {
    return;
  }

  // Reuse in-flight connection across concurrent callers
  if (connectionPromise) {
    await connectionPromise;
    return;
  }

  try {
    const uri = process.env.CONNECTION_STRING as string;
    connectionPromise = mongoose.connect(uri, {
      // Each serverless instance holds its own pool — keep it small so many
      // warm instances don't exhaust the cluster's connection limit.
      maxPoolSize: 5,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Indexes are managed by `npm run setup` (syncIndexes); don't re-issue
      // createIndex for every model on every cold start.
      autoIndex: false,
    });
    await connectionPromise;
    console.log("🟢 MongoDB connected");
  } catch (err) {
    // Reset so a later attempt can retry rather than reusing a rejected promise.
    connectionPromise = null;
    console.error("🔴 MongoDB connection error:", err);
    throw err;
  }
};

/** Clears cached connection state — used by tests. */
export const resetDbConnectionState = () => {
  connectionPromise = null;
};
