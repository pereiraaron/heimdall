import { Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  password: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
