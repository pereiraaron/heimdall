import { Response } from "express";
import {
  socialLogin,
  linkSocialAccount,
  unlinkSocialAccount,
  listSocialAccounts,
} from "../socialAuth";
import { User, UserProjectMembership, Project, SocialAccount, RefreshToken } from "@models";
import { ApiKeyRequest, AuthRequest, MembershipRole, MembershipStatus } from "@types";

jest.mock("@config/flags", () => ({
  GRANT_ACCESS_TO_ALL_PROJECTS: false,
}));

jest.mock("@services/grantAllProjectsAccess", () => ({
  grantAllProjectsAccess: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@services/socialProviders", () => ({
  exchangeCodeForProfile: jest.fn().mockResolvedValue({
    providerUserId: "provider-user-123",
    email: "social@example.com",
    displayName: "Social User",
  }),
}));

jest.mock("@models", () => ({
  User: {
    findById: jest.fn().mockReturnThis(),
    findOne: jest.fn(),
    create: jest.fn(),
    select: jest.fn(),
  },
  UserProjectMembership: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Project: {
    findById: jest.fn(),
  },
  SocialAccount: {
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    find: jest.fn().mockReturnThis(),
    create: jest.fn(),
    select: jest.fn(),
  },
  RefreshToken: {
    create: jest.fn(),
  },
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mock-access-token"),
}));

describe("Social Auth Controller", () => {
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });
    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };
    jest.clearAllMocks();
  });

  describe("socialLogin", () => {
    let mockRequest: Partial<ApiKeyRequest>;

    beforeEach(() => {
      mockRequest = {
        body: {
          provider: "google",
          code: "auth-code",
          redirectUri: "http://localhost/callback",
        },
        projectId: "project-123",
      };
    });

    it("should return 400 if provider, code, or redirectUri is missing", async () => {
      mockRequest.body = { provider: "google" };

      await socialLogin(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Provider, code, and redirectUri are required",
      });
    });

    it("should return 400 for unsupported provider", async () => {
      mockRequest.body = { provider: "twitter", code: "code", redirectUri: "http://localhost" };

      await socialLogin(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({ message: "Unsupported provider: twitter" });
    });

    it("should return 404 if project not found", async () => {
      (Project.findById as jest.Mock).mockResolvedValue(null);

      await socialLogin(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: "Project not found" });
    });

    it("should return 400 if provider is not enabled for project", async () => {
      (Project.findById as jest.Mock).mockResolvedValue({
        socialProviders: {
          google: { enabled: false, clientId: "", clientSecret: "" },
        },
      });

      await socialLogin(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "google is not enabled for this project",
      });
    });

    it("should login returning user with existing social account", async () => {
      (Project.findById as jest.Mock).mockResolvedValue({
        socialProviders: {
          google: { enabled: true, clientId: "id", clientSecret: "secret" },
        },
      });
      (SocialAccount.findOne as jest.Mock).mockResolvedValue({
        userId: "existing-user-id",
      });
      (User.findById as jest.Mock).mockResolvedValue({
        _id: { toString: () => "existing-user-id" },
        email: "social@example.com",
        username: "Social User",
        isActive: true,
      });
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue({
        _id: { toString: () => "membership-123" },
        role: MembershipRole.Member,
      });
      (RefreshToken.create as jest.Mock).mockResolvedValue({});

      await socialLogin(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Login successful" })
      );
    });

    it("should return 401 if returning user is disabled", async () => {
      (Project.findById as jest.Mock).mockResolvedValue({
        socialProviders: {
          google: { enabled: true, clientId: "id", clientSecret: "secret" },
        },
      });
      (SocialAccount.findOne as jest.Mock).mockResolvedValue({
        userId: "disabled-user-id",
      });
      (User.findById as jest.Mock).mockResolvedValue({
        _id: "disabled-user-id",
        isActive: false,
      });

      await socialLogin(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({ message: "Account is disabled" });
    });

    it("should return 403 if returning user has no active membership", async () => {
      (Project.findById as jest.Mock).mockResolvedValue({
        socialProviders: {
          google: { enabled: true, clientId: "id", clientSecret: "secret" },
        },
      });
      (SocialAccount.findOne as jest.Mock).mockResolvedValue({
        userId: "user-no-membership",
      });
      (User.findById as jest.Mock).mockResolvedValue({
        _id: "user-no-membership",
        isActive: true,
      });
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(null);

      await socialLogin(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(403);
    });

    it("should create new user and membership for unknown email", async () => {
      (Project.findById as jest.Mock).mockResolvedValue({
        socialProviders: {
          google: { enabled: true, clientId: "id", clientSecret: "secret" },
        },
      });
      (SocialAccount.findOne as jest.Mock).mockResolvedValue(null);
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue({
        _id: { toString: () => "new-user-id" },
        email: "social@example.com",
        username: "Social User",
      });
      (UserProjectMembership.create as jest.Mock).mockResolvedValue({
        _id: { toString: () => "new-membership-id" },
        role: MembershipRole.Member,
      });
      (SocialAccount.create as jest.Mock).mockResolvedValue({});
      (RefreshToken.create as jest.Mock).mockResolvedValue({});

      await socialLogin(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: "social@example.com" })
      );
      expect(SocialAccount.create).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it("should return 500 on error", async () => {
      (Project.findById as jest.Mock).mockRejectedValue(new Error("DB error"));

      await socialLogin(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({ message: "Social login failed" });
    });
  });

  describe("linkSocialAccount", () => {
    let mockRequest: Partial<AuthRequest>;

    beforeEach(() => {
      mockRequest = {
        body: {
          provider: "github",
          code: "gh-code",
          redirectUri: "http://localhost/callback",
        },
        user: {
          id: "user-123",
          email: "user@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership-123",
        },
      };
    });

    it("should return 400 if required fields are missing", async () => {
      mockRequest.body = { provider: "github" };

      await linkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
    });

    it("should return 400 for unsupported provider", async () => {
      mockRequest.body = { provider: "twitter", code: "code", redirectUri: "http://localhost" };

      await linkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
    });

    it("should return 404 if project not found", async () => {
      (Project.findById as jest.Mock).mockResolvedValue(null);

      await linkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
    });

    it("should return 409 if provider already linked to user", async () => {
      (Project.findById as jest.Mock).mockResolvedValue({
        socialProviders: {
          github: { enabled: true, clientId: "id", clientSecret: "secret" },
        },
      });
      (SocialAccount.findOne as jest.Mock).mockResolvedValue({ _id: "existing-link" });

      await linkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(409);
      expect(responseJson).toHaveBeenCalledWith({
        message: "github account is already linked",
      });
    });

    it("should return 409 if provider account linked to another user", async () => {
      (Project.findById as jest.Mock).mockResolvedValue({
        socialProviders: {
          github: { enabled: true, clientId: "id", clientSecret: "secret" },
        },
      });
      (SocialAccount.findOne as jest.Mock)
        .mockResolvedValueOnce(null) // No existing link for this user
        .mockResolvedValueOnce({ userId: "other-user-id" }); // But linked to another user

      await linkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(409);
      expect(responseJson).toHaveBeenCalledWith({
        message: "This github account is already linked to another user",
      });
    });

    it("should return 201 on successful link", async () => {
      (Project.findById as jest.Mock).mockResolvedValue({
        socialProviders: {
          github: { enabled: true, clientId: "id", clientSecret: "secret" },
        },
      });
      (SocialAccount.findOne as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      (SocialAccount.create as jest.Mock).mockResolvedValue({});

      await linkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(SocialAccount.create).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(201);
    });

    it("should return 500 on error", async () => {
      (Project.findById as jest.Mock).mockRejectedValue(new Error("DB error"));

      await linkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("unlinkSocialAccount", () => {
    let mockRequest: Partial<AuthRequest>;

    beforeEach(() => {
      mockRequest = {
        params: { provider: "google" },
        user: {
          id: "user-123",
          email: "user@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership-123",
        },
      };
    });

    it("should return 400 for unsupported provider", async () => {
      mockRequest.params = { provider: "twitter" };

      await unlinkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
    });

    it("should return 400 if this is the only auth method", async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ password: null }),
      });
      (SocialAccount.find as jest.Mock).mockResolvedValue([
        { provider: "google", userId: "user-123" },
      ]);

      await unlinkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Cannot unlink"),
        })
      );
    });

    it("should return 404 if no linked account found", async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ password: "hashed-pw" }),
      });
      (SocialAccount.find as jest.Mock).mockResolvedValue([
        { provider: "google", userId: "user-123" },
      ]);
      (SocialAccount.findOneAndDelete as jest.Mock).mockResolvedValue(null);

      await unlinkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
    });

    it("should return 200 on successful unlink when user has password", async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ password: "hashed-pw" }),
      });
      (SocialAccount.find as jest.Mock).mockResolvedValue([
        { provider: "google", userId: "user-123" },
      ]);
      (SocialAccount.findOneAndDelete as jest.Mock).mockResolvedValue({ _id: "deleted" });

      await unlinkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({
        message: "google account unlinked successfully",
      });
    });

    it("should allow unlink when user has another social provider", async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ password: null }),
      });
      (SocialAccount.find as jest.Mock).mockResolvedValue([
        { provider: "google", userId: "user-123" },
        { provider: "github", userId: "user-123" },
      ]);
      (SocialAccount.findOneAndDelete as jest.Mock).mockResolvedValue({ _id: "deleted" });

      await unlinkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it("should return 500 on error", async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error("DB error")),
      });

      await unlinkSocialAccount(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("listSocialAccounts", () => {
    let mockRequest: Partial<AuthRequest>;

    beforeEach(() => {
      mockRequest = {
        user: {
          id: "user-123",
          email: "user@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership-123",
        },
      };
    });

    it("should return 200 with accounts list", async () => {
      const mockAccounts = [{ provider: "google", email: "user@gmail.com" }];
      (SocialAccount.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAccounts),
      });

      await listSocialAccounts(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({ accounts: mockAccounts });
    });

    it("should return 500 on error", async () => {
      (SocialAccount.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error("DB error")),
      });

      await listSocialAccounts(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });
});
