import { Schema, model } from "mongoose";
import {
  IUserProjectMembership,
  MembershipRole,
  MembershipStatus,
} from "../types";

const userProjectMembershipSchema = new Schema<IUserProjectMembership>(
  {
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
    role: {
      type: String,
      enum: Object.values(MembershipRole),
      default: MembershipRole.Member,
    },
    status: {
      type: String,
      enum: Object.values(MembershipStatus),
      default: MembershipStatus.Active,
    },
    metadata: {
      preferences: {
        type: Schema.Types.Mixed,
        default: {},
      },
      settings: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    joinedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
userProjectMembershipSchema.index({ userId: 1, projectId: 1 }, { unique: true });
userProjectMembershipSchema.index({ projectId: 1, status: 1 });
userProjectMembershipSchema.index({ userId: 1, status: 1 });

export const UserProjectMembership = model<IUserProjectMembership>(
  "UserProjectMembership",
  userProjectMembershipSchema
);
