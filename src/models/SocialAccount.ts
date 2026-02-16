import { Schema, model } from "mongoose";
import { ISocialAccount, SocialProvider } from "@types";

const socialAccountSchema = new Schema<ISocialAccount>(
  {
    provider: {
      type: String,
      enum: Object.values(SocialProvider),
      required: true,
    },
    providerUserId: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

socialAccountSchema.index({ provider: 1, providerUserId: 1 }, { unique: true });
socialAccountSchema.index({ provider: 1, userId: 1 }, { unique: true });
socialAccountSchema.index({ userId: 1 });

export const SocialAccount = model("SocialAccount", socialAccountSchema);
