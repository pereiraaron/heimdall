import { cleanupOrphanedUser } from "../cleanupUserData";
import {
  User,
  UserProjectMembership,
  RefreshToken,
  PasskeyCredential,
  SocialAccount,
} from "../../models";

jest.mock("../../models", () => ({
  User: {
    findByIdAndDelete: jest.fn().mockResolvedValue(undefined),
  },
  UserProjectMembership: {
    countDocuments: jest.fn(),
  },
  RefreshToken: {
    deleteMany: jest.fn().mockResolvedValue(undefined),
  },
  PasskeyCredential: {
    deleteMany: jest.fn().mockResolvedValue(undefined),
  },
  SocialAccount: {
    deleteMany: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("cleanupOrphanedUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not delete user if they have remaining memberships", async () => {
    (UserProjectMembership.countDocuments as jest.Mock).mockResolvedValue(2);

    await cleanupOrphanedUser("user-123");

    expect(UserProjectMembership.countDocuments).toHaveBeenCalledWith({ userId: "user-123" });
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
    expect(RefreshToken.deleteMany).not.toHaveBeenCalled();
    expect(PasskeyCredential.deleteMany).not.toHaveBeenCalled();
    expect(SocialAccount.deleteMany).not.toHaveBeenCalled();
  });

  it("should delete user and all associated records if no memberships remain", async () => {
    (UserProjectMembership.countDocuments as jest.Mock).mockResolvedValue(0);

    await cleanupOrphanedUser("user-123");

    expect(RefreshToken.deleteMany).toHaveBeenCalledWith({ userId: "user-123" });
    expect(PasskeyCredential.deleteMany).toHaveBeenCalledWith({ userId: "user-123" });
    expect(SocialAccount.deleteMany).toHaveBeenCalledWith({ userId: "user-123" });
    expect(User.findByIdAndDelete).toHaveBeenCalledWith("user-123");
  });

  it("should not delete if exactly one membership remains", async () => {
    (UserProjectMembership.countDocuments as jest.Mock).mockResolvedValue(1);

    await cleanupOrphanedUser("user-123");

    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
