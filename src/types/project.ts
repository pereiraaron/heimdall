import { Document } from "mongoose";

export interface IProject extends Document {
  name: string;
  apiKey: string;
  createdAt: Date;
  updatedAt: Date;
}
