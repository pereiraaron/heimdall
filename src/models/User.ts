import { Schema, model } from "mongoose";
import { IUser, UserRole } from "../types";

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
      required: true,
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
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  }
);

export const User = model("User", userSchema);
