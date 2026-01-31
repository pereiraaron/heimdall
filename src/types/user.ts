export enum UserRole {
  User = "user",
  Admin = "admin",
  Manager = "manager",
}

export interface IUser extends Document {
  projectIds: string[];
  username: string;
  password: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}
