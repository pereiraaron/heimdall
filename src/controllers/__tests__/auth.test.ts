import { Request, Response } from "express";
import { login, register } from "../auth";
import { User } from "../../models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserRole } from "../../types";

// Mock dependencies
jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn(),
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
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    // Mock response object
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });

    mockRequest = {
      body: {
        email: "test@example.com",
        password: "password123",
      },
    };

    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };

    // Set JWT Secret for tests
    process.env = { ...originalEnv, JWT_SECRET: "test-secret-key" };

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("login", () => {
    it("should return 400 if email or password is missing", async () => {
      // Missing password
      mockRequest.body = { email: "test@example.com" };
      await login(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Username or password are required",
      });

      // Missing email
      mockRequest.body = { password: "password123" };
      await login(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Username or password are required",
      });

      // Both missing
      mockRequest.body = {};
      await login(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Username or password are required",
      });
    });

    it("should return 401 if user is not found", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockResolvedValueOnce(null);

      await login(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Invalid credentials",
      });
    });

    it("should return 401 if password is invalid", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockResolvedValueOnce({
        _id: "user123",
        email: "test@example.com",
        password: "hashedPassword",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await login(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Invalid credentials",
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
      };

      (User.findOne as jest.Mock).mockResolvedValueOnce(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      (jwt.sign as jest.Mock).mockReturnValueOnce("test-token");

      await login(mockRequest as Request, mockResponse as Response);

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
      (User.findOne as jest.Mock).mockRejectedValueOnce(
        new Error("Database error")
      );

      await login(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Login failed",
        error: expect.any(Error),
      });
    });
  });

  describe("register", () => {
    it("should return 400 if email or password is missing", async () => {
      // Missing password
      mockRequest.body = { email: "test@example.com" };
      await register(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Username or password are required",
      });
    });

    it("should return 400 if user already exists", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };
      (User.findOne as jest.Mock).mockResolvedValueOnce({
        email: "test@example.com",
      });

      await register(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Username with email test@example.com already exists",
      });
    });

    it("should return 201 on successful registration", async () => {
      // Setup
      mockRequest.body = { email: "test@example.com", password: "password123" };

      // Mock findOne to return null (user doesn't exist)
      (User.findOne as jest.Mock).mockResolvedValueOnce(null);

      // Mock bcrypt hash
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce("hashedPassword");

      // Create a mock for the User constructor and save method
      const mockSave = jest.fn().mockResolvedValueOnce(undefined);
      const mockUser = { save: mockSave };

      // Need to update the mock for the User constructor
      const originalUser = jest.requireMock("../../models").User;
      jest.requireMock("../../models").User = function () {
        return mockUser;
      };
      jest.requireMock("../../models").User.findOne = originalUser.findOne;

      // Act
      await register(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(mockSave).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith({
        message: "User registered with email test@example.com",
      });

      // Restore the original User mock
      jest.requireMock("../../models").User = originalUser;
    });

    it("should return 500 on server error", async () => {
      mockRequest.body = { email: "test@example.com", password: "password123" };

      // Mock findOne to return null first, so it proceeds past the user exists check
      (User.findOne as jest.Mock).mockResolvedValueOnce(null);

      // Then make bcrypt.hash throw an error
      (bcrypt.hash as jest.Mock).mockRejectedValueOnce(
        new Error("Hashing error")
      );

      await register(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Registration failed",
        error: expect.any(Error),
      });
    });
  });
});
