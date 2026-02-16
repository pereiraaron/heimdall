import { Schema, model } from "mongoose";
import { IRefreshToken } from "../types";

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    membershipId: {
      type: Schema.Types.ObjectId,
      ref: "UserProjectMembership",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index: MongoDB automatically deletes expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1, projectId: 1 });
refreshTokenSchema.index({ token: 1 });

export const RefreshToken = model<IRefreshToken>("RefreshToken", refreshTokenSchema);
