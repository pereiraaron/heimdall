import { Document } from "mongoose";

/** @deprecated Use MembershipRole instead for per-project roles */
export enum UserRole {
  User = "user",
  Admin = "admin",
  Manager = "manager",
}

export interface IUser extends Document {
  username: string;
  password: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
