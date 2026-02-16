import { Document, Types } from "mongoose";

export enum MembershipRole {
  Owner = "owner",
  Admin = "admin",
  Manager = "manager",
  Member = "member",
}

export enum MembershipStatus {
  Active = "active",
  Pending = "pending",
  Suspended = "suspended",
}

export interface IMembershipMetadata {
  preferences?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface IUserProjectMembership extends Document {
  userId: Types.ObjectId;
  projectId: Types.ObjectId;
  role: MembershipRole;
  status: MembershipStatus;
  metadata: IMembershipMetadata;
  invitedBy?: Types.ObjectId;
  joinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const ROLE_HIERARCHY: Record<MembershipRole, number> = {
  [MembershipRole.Owner]: 4,
  [MembershipRole.Admin]: 3,
  [MembershipRole.Manager]: 2,
  [MembershipRole.Member]: 1,
};

export const canManageRole = (actorRole: MembershipRole, targetRole: MembershipRole): boolean => {
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
};
