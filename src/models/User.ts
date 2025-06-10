import { Schema, model } from "mongoose";
import { AuthProvider, IUser, UserRole } from "../types";

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      trim: true,
      required: true,
    },
    password: {
      type: String,
      required: function () {
        return this.provider === AuthProvider.Local;
      },
      minlength: 6,
      select: false, // Exclude password from queries by default
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    role: {
      type: String,
      enum: [UserRole.Admin, UserRole.Manager, UserRole.User],
      default: UserRole.User,
    },
    provider: {
      type: String,
      enum: [
        AuthProvider.Local,
        AuthProvider.Google,
        AuthProvider.Facebook,
        AuthProvider.Twitter,
      ],
      default: AuthProvider.Local,
    },
    providerId: {
      type: String,
    },
    profile: {
      displayName: String,
      photos: [{ value: String }],
      emails: [{ value: String }],
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  }
);

export const User = model("User", userSchema);
