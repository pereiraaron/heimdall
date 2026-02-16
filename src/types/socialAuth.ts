import { Document, Types } from "mongoose";

export enum SocialProvider {
  Google = "google",
  GitHub = "github",
  Apple = "apple",
}

export interface ISocialProviderConfig {
  clientId: string;
  clientSecret: string;
  enabled: boolean;
}

export interface IAppleProviderConfig extends ISocialProviderConfig {
  teamId: string;
  keyId: string;
  privateKey: string;
}

export interface IProjectSocialProviders {
  google?: ISocialProviderConfig;
  github?: ISocialProviderConfig;
  apple?: IAppleProviderConfig;
}

export interface ISocialAccount extends Document {
  provider: SocialProvider;
  providerUserId: string;
  userId: Types.ObjectId;
  email: string;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialProfile {
  providerUserId: string;
  email: string;
  displayName?: string;
}
