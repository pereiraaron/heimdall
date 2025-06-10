import { Request } from "express";
import { IUser } from "./user";

// Extend Express types to support authenticated users with Passport
declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

export interface AuthRequest extends Request {
  user?: IUser;
}
