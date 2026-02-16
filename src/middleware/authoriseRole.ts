import { Response, NextFunction } from "express";
import { AuthRequest, MembershipRole, ROLE_HIERARCHY } from "../types";

export const authoriseRole = (roles: MembershipRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role as MembershipRole;

    if (!userRole) {
      res.status(403).json({ message: "Access denied. No role provided." });
      return;
    }

    // Check if user's role level meets the minimum required level
    const userRoleLevel = ROLE_HIERARCHY[userRole];
    const minRequiredLevel = Math.min(...roles.map((r) => ROLE_HIERARCHY[r]));

    if (userRoleLevel < minRequiredLevel) {
      res.status(403).json({ message: "Access denied. Insufficient permissions." });
      return;
    }

    next();
  };
};
