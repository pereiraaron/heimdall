import { Response } from "express";
import { login, register } from "../auth";
import { User } from "../../models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ApiKeyRequest } from "../../types";

jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn().mockReturnValue({
      select: jest.fn(),
    }),
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
          projectIds: ["project-123"],
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Invalid credentials",
      });
    });

    it("should return 403 if user is not associated with project", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          _id: "user123",
          email: "test@example.com",
          password: "hashedPassword",
          projectIds: ["other-project"],
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(403);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Access denied",
      });
    });

    it("should return 200 and token on successful login", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        password: "hashedPassword",
        username: "testuser",
        role: "user",
        projectIds: ["project-123"],
      };

      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(mockUser),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      (jwt.sign as jest.Mock).mockReturnValueOnce("test-token");

      await login(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(jwt.sign).toHaveBeenCalledWith(
        { id: "user123", email: "test@example.com", role: "user", projectId: "project-123" },
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
          role: "user",
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

    it("should return 400 if user already exists for this project", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          email: "test@example.com",
          projectIds: ["project-123"],
        }),
      });

      await register(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "User already exists",
      });
    });

    it("should return 401 if existing user provides wrong password", async () => {
      mockRequest.body = { email: "test@example.com", password: "wrongpassword" };
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          email: "test@example.com",
          password: "hashedPassword",
          projectIds: ["other-project"],
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await register(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Invalid credentials",
      });
    });

    it("should add existing user to new project with correct password", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      const mockSave = jest.fn().mockResolvedValueOnce(undefined);
      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          email: "test@example.com",
          password: "hashedPassword",
          projectIds: ["other-project"],
          save: mockSave,
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      await register(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(mockSave).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Registration successful",
      });
    });

    it("should return 201 on successful new user registration", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };

      (User.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce("hashedPassword");

      const mockSave = jest.fn().mockResolvedValueOnce(undefined);
      const originalUser = jest.requireMock("../../models").User;
      jest.requireMock("../../models").User = function () {
        return { save: mockSave };
      };
      jest.requireMock("../../models").User.findOne = originalUser.findOne;

      await register(mockRequest as ApiKeyRequest, mockResponse as Response);

      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(mockSave).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith({
        message: "User registered with email test@example.com",
      });

      jest.requireMock("../../models").User = originalUser;
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
