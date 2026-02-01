import { Request } from "express";
import { MembershipRole, IUserProjectMembership } from "./membership";

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
}
