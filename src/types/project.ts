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

/**
 * The subset of a project that request handlers actually need, cached
 * per-instance so a request never re-reads the project document.
 */
export interface ProjectConfig {
  id: string;
  name?: string;
  passkeyPolicy?: PasskeyPolicy;
  webauthnRpIds?: string[];
  webauthnOrigins?: string[];
  socialProviders?: IProjectSocialProviders;
}
