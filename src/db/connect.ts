import mongoose from "mongoose";

export const connectToDB = async () => {
  try {
    const uri = process.env.CONNECTION_STRING as string;
    await mongoose.connect(uri);
    console.log("🟢 MongoDB connected");
  } catch (err) {
    console.error("🔴 MongoDB connection error:", err);
    process.exit(1);
  }
};
