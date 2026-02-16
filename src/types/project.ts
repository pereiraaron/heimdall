import { Document } from "mongoose";
import { IProjectSocialProviders } from "./socialAuth";

export type PasskeyPolicy = "optional" | "encouraged";

export interface IProject extends Document {
  name: string;
  apiKey: string;
  passkeyPolicy: PasskeyPolicy;
  webauthnRpIds?: string[];
  webauthnOrigins?: string[];
  socialProviders?: IProjectSocialProviders;
  createdAt: Date;
  updatedAt: Date;
}
