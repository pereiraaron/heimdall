import { Response, NextFunction } from "express";
import { AuthRequest, UserRole } from "../types";

export const authoriseRole = (roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role; // Assuming req.user is set by the authenticate middleware

    if (!userRole) {
      res.status(403).json({ message: "Access denied. No role provided." });
      return;
    }

    if (!roles.includes(userRole)) {
      res
        .status(403)
        .json({ message: "Access denied. Insufficient permissions." });
      return;
    }

    next();
  };
};
