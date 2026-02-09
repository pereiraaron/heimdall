import { Schema, model } from "mongoose";
import { IWebAuthnChallenge } from "../types";

const webAuthnChallengeSchema = new Schema<IWebAuthnChallenge>({
  challenge: {
    type: String,
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

// TTL index: MongoDB automatically deletes expired challenges
webAuthnChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const WebAuthnChallenge = model<IWebAuthnChallenge>(
  "WebAuthnChallenge",
  webAuthnChallengeSchema
);
