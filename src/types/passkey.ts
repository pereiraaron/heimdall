import { Document, Types } from "mongoose";

export interface IPasskeyCredential extends Document {
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  userId: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWebAuthnChallenge extends Document {
  challenge: string;
  userId?: Types.ObjectId;
  expiresAt: Date;
}
