import { Document } from "mongoose";

export type PasskeyPolicy = "optional" | "encouraged";

export interface IProject extends Document {
  name: string;
  apiKey: string;
  passkeyPolicy: PasskeyPolicy;
  webauthnRpIds?: string[];
  webauthnOrigins?: string[];
  createdAt: Date;
  updatedAt: Date;
}
