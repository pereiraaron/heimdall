import { Request } from "express";
import { MembershipRole, IUserProjectMembership } from "./membership";
import { ProjectConfig } from "./project";

export interface JwtPayload {
  id: string;
  email: string;
  role: MembershipRole;
  projectId: string;
  membershipId: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload & {
    membership?: IUserProjectMembership;
  };
}

export interface ApiKeyRequest extends Request {
  projectId?: string;
  /** Cached project config, populated by the validateApiKey middleware. */
  project?: ProjectConfig;
}
