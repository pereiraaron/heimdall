import dotenv from "dotenv";
import mongoose from "mongoose";
import { Project } from "../src/models";

dotenv.config();

const createProject = async () => {
  const name = process.argv[2];

  if (!name) {
    console.error("Usage: npx ts-node scripts/createProject.ts <project-name>");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.CONNECTION_STRING as string);
    console.log("Connected to MongoDB");

    const project = new Project({ name });
    await project.save();

    console.log("\n✅ Project created successfully!\n");
    console.log(`   Name:    ${project.name}`);
    console.log(`   ID:      ${project._id}`);
    console.log(`   API Key: ${project.apiKey}`);
    console.log("\n⚠️  Save the API key - it cannot be retrieved later.\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Failed to create project:", error);
    process.exit(1);
  }
};

createProject();
