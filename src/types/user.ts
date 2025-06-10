export enum UserRole {
  User = "user",
  Admin = "admin",
  Manager = "manager",
}

export enum AuthProvider {
  Local = "local",
  Google = "google",
  Facebook = "facebook",
  Twitter = "twitter",
}

export interface IUser extends Document {
  username: string;
  password?: string; // Optional for social logins
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  provider: AuthProvider;
  providerId?: string; // ID from the provider (Google, Facebook, etc.)
  profile?: {
    displayName?: string;
    photos?: { value: string }[];
    emails?: { value: string }[];
  };
}
