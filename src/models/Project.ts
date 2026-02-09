import { Schema, model } from "mongoose";
import crypto from "crypto";
import { IProject } from "../types";

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    apiKey: {
      type: String,
      unique: true,
      required: true,
      default: () => `hm_${crypto.randomBytes(32).toString("hex")}`,
    },
    passkeyPolicy: {
      type: String,
      enum: ["optional", "encouraged"],
      default: "optional",
    },
  },
  {
    timestamps: true,
  }
);

export const Project = model("Project", projectSchema);
