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
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    await connectionPromise;
    console.log("🟢 MongoDB connected");
  } catch (err) {
    connectionPromise = null;
    console.error("🔴 MongoDB connection error:", err);
    process.exit(1);
  }
};

/** Clears cached connection state — used by tests. */
export const resetDbConnectionState = () => {
  connectionPromise = null;
};
