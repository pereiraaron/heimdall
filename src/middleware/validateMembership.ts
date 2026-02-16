import { Response, NextFunction } from "express";
import { UserProjectMembership } from "../models";
import { AuthRequest, MembershipRole, MembershipStatus, ROLE_HIERARCHY } from "../types";

export const validateMembership = (requiredRoles?: MembershipRole[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const projectId = req.user?.projectId;

    if (!userId || !projectId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    try {
      const membership = await UserProjectMembership.findOne({
        userId,
        projectId,
        status: MembershipStatus.Active,
      });

      if (!membership) {
        res.status(403).json({ message: "No active membership for this project" });
        return;
      }

      if (requiredRoles && requiredRoles.length > 0) {
        const userRoleLevel = ROLE_HIERARCHY[membership.role as MembershipRole];
        const minRequiredLevel = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r]));

        if (userRoleLevel < minRequiredLevel) {
          res.status(403).json({ message: "Insufficient permissions" });
          return;
        }
      }

      req.user!.membership = membership;
      req.user!.role = membership.role as MembershipRole;
      next();
    } catch (error) {
      res.status(500).json({ message: "Membership validation failed" });
    }
  };
};
