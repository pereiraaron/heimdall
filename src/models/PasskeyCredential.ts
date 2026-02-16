import { Schema, model } from "mongoose";
import { IPasskeyCredential } from "@types";

const passkeyCredentialSchema = new Schema<IPasskeyCredential>(
  {
    credentialId: {
      type: String,
      required: true,
      unique: true,
    },
    publicKey: {
      type: Buffer,
      required: true,
    },
    counter: {
      type: Number,
      required: true,
      default: 0,
    },
    deviceType: {
      type: String,
      required: true,
    },
    backedUp: {
      type: Boolean,
      required: true,
    },
    transports: {
      type: [String],
      default: [],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      default: () => `Passkey ${new Date().toLocaleDateString()}`,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

passkeyCredentialSchema.index({ userId: 1 });

export const PasskeyCredential = model<IPasskeyCredential>(
  "PasskeyCredential",
  passkeyCredentialSchema
);
