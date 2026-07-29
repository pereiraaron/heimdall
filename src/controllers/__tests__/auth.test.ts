import { Response } from "express";
import { login, register, refresh, logout } from "../auth";
import { User, UserProjectMembership, RefreshToken, PasskeyCredential } from "../../models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ApiKeyRequest, AuthRequest, MembershipRole, MembershipStatus } from "../../types";

jest.mock("../../config/flags", () => ({
  GRANT_ACCESS_TO_ALL_PROJECTS: false,
}));

jest.mock("../../services/grantAllProjectsAccess", () => ({
  grantAllProjectsAccess: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../services/projectConfig", () => ({
  getProjectById: jest.fn().mockResolvedValue({ id: "project-123", passkeyPolicy: "optional" }),
}));

jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn().mockReturnValue({
      select: jest.fn(),
    }),
    findById: jest.fn(),
    create: jest.fn(),
  },
  UserProjectMembership: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  RefreshToken: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  PasskeyCredential: {
    exists: jest.fn(),
  },
}));

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
}));

describe("Auth Controller", () => {
  let mockRequest: Partial<ApiKeyRequest>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });

    mockRequest = {
      body: {
        email: "test@example.com",
        password: "password123",
      },
      projectId: "project-123",
      // validateApiKey populates this — handlers must not re-read the project.
      project: { id: "project-123", passkeyPolicy: "optional" },
    };

    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };

    process.env = { ...originalEnv, JWT_SECRET: "test-secret-key" };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("login", () => {
    it("should return 400 if email or password is missing", async () => {
      mockRequest.body = { email: "test@example.com" };
      await login(mockRequest as ApiKeyRequest, mockResponse as Response);
      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Email and password are required",
      });
    });

    it("should return 401 if user is not found", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      });

      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Invalid credentials",
      });
    });

    it("should return 401 if password is invalid", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: "user123",
            email: "test@example.com",
            password: "hashedPassword",
          }),
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
    });

    it("should return 403 if user has no active membership for project", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: "user123",
            email: "test@example.com",
            password: "hashedPassword",
          }),
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      (UserProjectMembership.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(null),
      });
      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(403);
    });

    it("should return 200 with accessToken and refreshToken on successful login", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      const mockUser = {
        _id: { toString: () => "user123" },
        email: "test@example.com",
        password: "hashedPassword",
        username: "testuser",
      };
      const mockMembership = {
        _id: { toString: () => "membership123" },
        role: MembershipRole.Member,
        status: MembershipStatus.Active,
      };

      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockUser) }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      (UserProjectMembership.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(mockMembership),
      });
      (jwt.sign as jest.Mock).mockReturnValueOnce("test-access-token");
      (RefreshToken.create as jest.Mock).mockResolvedValueOnce({});
      (PasskeyCredential.exists as jest.Mock).mockResolvedValueOnce(null);

      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: "user123",
          email: "test@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership123",
        },
        "test-secret-key",
        { expiresIn: "24h" }
      );
      expect(RefreshToken.create).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Login successful",
          accessToken: "test-access-token",
          refreshToken: expect.any(String),
        })
      );
    });

    it("should skip the passkey lookup when the project policy is optional", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: { toString: () => "user123" },
            email: "test@example.com",
            password: "hashedPassword",
          }),
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      (UserProjectMembership.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: { toString: () => "membership123" },
          role: MembershipRole.Member,
        }),
      });
      (jwt.sign as jest.Mock).mockReturnValueOnce("token");
      (RefreshToken.create as jest.Mock).mockResolvedValueOnce({});

      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(PasskeyCredential.exists).not.toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.not.objectContaining({ passkeySetupRequired: true })
      );
    });

    it("should flag passkey setup when the policy is encouraged and the user has none", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      mockRequest.project = { id: "project-123", passkeyPolicy: "encouraged" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: { toString: () => "user123" },
            email: "test@example.com",
            password: "hashedPassword",
          }),
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      (UserProjectMembership.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: { toString: () => "membership123" },
          role: MembershipRole.Member,
        }),
      });
      (PasskeyCredential.exists as jest.Mock).mockResolvedValueOnce(null);
      (jwt.sign as jest.Mock).mockReturnValueOnce("token");
      (RefreshToken.create as jest.Mock).mockResolvedValueOnce({});

      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(PasskeyCredential.exists).toHaveBeenCalledTimes(1);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({ passkeySetupRequired: true })
      );
    });

    it("should return 500 on server error", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("refresh", () => {
    it("should return 400 if refresh token is missing", async () => {
      mockRequest.body = {};
      await refresh(mockRequest as ApiKeyRequest, mockResponse as Response);
      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Refresh token is required",
      });
    });

    it("should return 401 if refresh token is invalid", async () => {
      mockRequest.body = { refreshToken: "invalid-token" };
      (RefreshToken.findOneAndUpdate as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(null),
      });

      await refresh(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Invalid refresh token",
      });
    });

    it("should return 401 if refresh token is expired", async () => {
      mockRequest.body = { refreshToken: "expired-token" };
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      (RefreshToken.findOneAndUpdate as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ expiresAt: pastDate, isRevoked: false }),
      });

      await refresh(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Refresh token expired",
      });
    });

    it("should return 200 with new token pair on valid refresh", async () => {
      mockRequest.body = { refreshToken: "valid-refresh-token" };
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      (RefreshToken.findOneAndUpdate as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          userId: "user123",
          projectId: "project-123",
          membershipId: "membership123",
          expiresAt: futureDate,
          isRevoked: false,
        }),
      });
      (UserProjectMembership.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: { toString: () => "membership123" },
          role: MembershipRole.Member,
          status: MembershipStatus.Active,
        }),
      });
      (User.findById as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: { toString: () => "user123" },
            email: "test@example.com",
          }),
        }),
      });
      (jwt.sign as jest.Mock).mockReturnValueOnce("new-access-token");
      (RefreshToken.create as jest.Mock).mockResolvedValueOnce({});

      await refresh(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: "new-access-token",
          refreshToken: expect.any(String),
        })
      );
    });

    it("should claim and revoke the old token in a single atomic update", async () => {
      mockRequest.body = { refreshToken: "valid-refresh-token" };
      (RefreshToken.findOneAndUpdate as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(null),
      });

      await refresh(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(RefreshToken.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(RefreshToken.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "project-123", isRevoked: false }),
        { isRevoked: true },
        { new: false }
      );
    });
  });

  describe("logout", () => {
    it("should return 400 if refresh token is missing", async () => {
      const authRequest: Partial<AuthRequest> = {
        body: {},
        user: {
          id: "user123",
          email: "test@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership123",
        },
      };

      await logout(authRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Refresh token is required",
      });
    });

    it("should return 200 on successful logout", async () => {
      const authRequest: Partial<AuthRequest> = {
        body: { refreshToken: "some-token" },
        user: {
          id: "user123",
          email: "test@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership123",
        },
      };

      (RefreshToken.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({ isRevoked: true });

      await logout(authRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({ message: "Logged out" });
    });
  });

  describe("register", () => {
    it("should return 400 if email or password is missing", async () => {
      mockRequest.body = { email: "test@example.com" };
      await register(mockRequest as ApiKeyRequest, mockResponse as Response);
      expect(responseStatus).toHaveBeenCalledWith(400);
    });

    it("should return 400 if user already has active membership for this project", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: "user123",
            email: "test@example.com",
            password: "hashedPassword",
          }),
        }),
      });
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValueOnce({
        status: MembershipStatus.Active,
      });

      await register(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
    });

    it("should return 201 on successful new user registration", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };

      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce("hashedPassword");
      (User.create as jest.Mock).mockResolvedValueOnce({
        _id: "newuser123",
        email: "test@example.com",
      });
      (UserProjectMembership.create as jest.Mock).mockResolvedValueOnce({});

      await register(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(201);
    });

    it("should return 500 on server error", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };

      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      });
      (bcrypt.hash as jest.Mock).mockRejectedValueOnce(new Error("Hashing error"));

      await register(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });
});
