import { Request } from "express";

export interface AuthRequest extends Request {
  user?: any;
}

export interface ApiKeyRequest extends Request {
  projectId?: string;
}
