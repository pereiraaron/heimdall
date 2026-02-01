import { Response } from "express";
import { login, register } from "../auth";
import { User, UserProjectMembership } from "../../models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ApiKeyRequest, MembershipRole, MembershipStatus } from "../../types";

jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn().mockReturnValue({
      select: jest.fn(),
    }),
    create: jest.fn(),
  },
  UserProjectMembership: {
    findOne: jest.fn(),
    create: jest.fn(),
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

      mockRequest.body = { password: "password123" };
      await login(mockRequest as ApiKeyRequest, mockResponse as Response);
      expect(responseStatus).toHaveBeenCalledWith(400);

      mockRequest.body = {};
      await login(mockRequest as ApiKeyRequest, mockResponse as Response);
      expect(responseStatus).toHaveBeenCalledWith(400);
    });

    it("should return 401 if user is not found", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
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
        select: jest.fn().mockResolvedValueOnce({
          _id: "user123",
          email: "test@example.com",
          password: "hashedPassword",
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Invalid credentials",
      });
    });

    it("should return 403 if user has no active membership for project", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          _id: "user123",
          email: "test@example.com",
          password: "hashedPassword",
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValueOnce(null);

      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(403);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Access denied. No active membership for this project.",
      });
    });

    it("should return 200 and token on successful login", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        password: "hashedPassword",
        username: "testuser",
      };
      const mockMembership = {
        _id: "membership123",
        userId: "user123",
        projectId: "project-123",
        role: MembershipRole.Member,
        status: MembershipStatus.Active,
      };

      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(mockUser),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValueOnce(mockMembership);
      (jwt.sign as jest.Mock).mockReturnValueOnce("test-token");

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
        { expiresIn: "1h" }
      );
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Login successful",
        token: "test-token",
        user: {
          id: "user123",
          username: "testuser",
          role: MembershipRole.Member,
        },
      });
    });

    it("should return 500 on server error", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockRejectedValueOnce(new Error("Database error")),
      });

      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Login failed",
        error: expect.any(Error),
      });
    });
  });

  describe("register", () => {
    it("should return 400 if email or password is missing", async () => {
      mockRequest.body = { email: "test@example.com" };
      await register(mockRequest as ApiKeyRequest, mockResponse as Response);
      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Email and password are required",
      });
    });

    it("should return 400 if user already has active membership for this project", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          _id: "user123",
          email: "test@example.com",
          password: "hashedPassword",
        }),
      });
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValueOnce({
        status: MembershipStatus.Active,
      });

      await register(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "User already registered for this project",
      });
    });

    it("should return 401 if existing user provides wrong password", async () => {
      mockRequest.body = { email: "test@example.com", password: "wrongpassword" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          _id: "user123",
          email: "test@example.com",
          password: "hashedPassword",
        }),
      });
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await register(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Invalid credentials",
      });
    });

    it("should create membership for existing user with correct password", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          _id: "user123",
          email: "test@example.com",
          password: "hashedPassword",
        }),
      });
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      (UserProjectMembership.create as jest.Mock).mockResolvedValueOnce({});

      await register(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(UserProjectMembership.create).toHaveBeenCalledWith({
        userId: "user123",
        projectId: "project-123",
        role: MembershipRole.Member,
        status: MembershipStatus.Active,
        joinedAt: expect.any(Date),
      });
      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith({
        message: "User registered with email test@example.com",
      });
    });

    it("should return 201 on successful new user registration", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };

      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce("hashedPassword");
      (User.create as jest.Mock).mockResolvedValueOnce({
        _id: "newuser123",
        email: "test@example.com",
      });
      (UserProjectMembership.create as jest.Mock).mockResolvedValueOnce({});

      await register(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(User.create).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "hashedPassword",
      });
      expect(UserProjectMembership.create).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith({
        message: "User registered with email test@example.com",
      });
    });

    it("should return 500 on server error", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };

      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });
      (bcrypt.hash as jest.Mock).mockRejectedValueOnce(new Error("Hashing error"));

      await register(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Registration failed",
        error: expect.any(Error),
      });
    });
  });
});
