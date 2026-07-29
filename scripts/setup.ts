import dotenv from "dotenv";
import mongoose from "mongoose";
import {
  User,
  Project,
  UserProjectMembership,
  RefreshToken,
  PasskeyCredential,
  WebAuthnChallenge,
  SocialAccount,
} from "../src/models";

dotenv.config();

const models = [
  User,
  Project,
  UserProjectMembership,
  RefreshToken,
  PasskeyCredential,
  WebAuthnChallenge,
  SocialAccount,
];

const setup = async () => {
  console.log("\n🔧 Heimdall Database Setup\n");

  const connectionString = process.env.CONNECTION_STRING;
  if (!connectionString) {
    console.error("❌ CONNECTION_STRING not set in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(connectionString);
    console.log("Connected to MongoDB\n");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  }

  console.log("Creating collections and syncing indexes...\n");

  for (const model of models) {
    const name = model.modelName;
    try {
      // createCollection is a no-op if it already exists
      await model.createCollection();

      // syncIndexes drops stale indexes and creates missing ones
      const dropped = await model.syncIndexes();

      const indexes = await model.listIndexes();
      const indexNames = indexes.filter((idx) => idx.name !== "_id_").map((idx) => idx.name);

      if (indexNames.length > 0) {
        console.log(`  ✅ ${name} (${indexNames.length} indexes: ${indexNames.join(", ")})`);
      } else {
        console.log(`  ✅ ${name}`);
      }

      if (dropped.length > 0) {
        console.log(`     ↳ dropped stale indexes: ${dropped.join(", ")}`);
      }
    } catch (err) {
      console.error(`  ❌ ${name}: ${err}`);
    }
  }

  console.log("\n────────────────────────────────────");
  console.log("  Database setup complete!");
  console.log("────────────────────────────────────\n");

  await mongoose.disconnect();
  process.exit(0);
};

setup();
