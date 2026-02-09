import { Document } from "mongoose";

export type PasskeyPolicy = "optional" | "encouraged";

export interface IProject extends Document {
  name: string;
  apiKey: string;
  passkeyPolicy: PasskeyPolicy;
  createdAt: Date;
  updatedAt: Date;
}
