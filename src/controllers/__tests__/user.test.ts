import { Request, Response } from "express";
import mongoose from "mongoose";
import { UserRole } from "../../types";
import {
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
} from "../user";
import { User } from "../../models";

// Setup: Make sure mongoose doesn't actually connect to a database during tests
jest.mock("mongoose", () => {
  const originalModule = jest.requireActual("mongoose");
  return {
    __esModule: true,
    ...originalModule,
    connect: jest.fn().mockResolvedValue(true),
  };
});

// Mock the User model
jest.mock("../../models", () => ({
  User: {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

beforeAll(() => {
  // Global setup before tests
});

afterAll(() => {
  // Global cleanup after tests
  jest.clearAllMocks();
});

describe("User Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });

    mockRequest = {
      params: {
        id: "mock-user-id",
      },
      body: {
        email: "test@example.com",
        role: UserRole.User,
      },
    };

    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe("getAllUsers", () => {
    it("should return all users with status 200", async () => {
      const mockUsers = [
        { _id: "1", email: "user1@example.com", role: UserRole.User },
        { _id: "2", email: "user2@example.com", role: UserRole.Admin },
      ];

      (User.find as jest.Mock).mockResolvedValue(mockUsers);

      await getAllUsers(mockRequest as Request, mockResponse as Response);

      expect(User.find).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(mockUsers);
    });

    it("should handle errors and return status 500", async () => {
      const error = new Error("Database error");
      (User.find as jest.Mock).mockRejectedValue(error);

      await getAllUsers(mockRequest as Request, mockResponse as Response);

      expect(User.find).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error fetching users",
        error,
      });
    });
  });

  describe("getUserById", () => {
    it("should return a user with status 200 when user exists", async () => {
      const mockUser = {
        _id: "mock-user-id",
        email: "user@example.com",
        role: UserRole.User,
      };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await getUserById(mockRequest as Request, mockResponse as Response);

      expect(User.findById).toHaveBeenCalledWith("mock-user-id");
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(mockUser);
    });

    it("should return a 404 status when user does not exist", async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await getUserById(mockRequest as Request, mockResponse as Response);

      expect(User.findById).toHaveBeenCalledWith("mock-user-id");
      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should handle invalid MongoDB ObjectId errors", async () => {
      const error = new Error("Invalid ID format");
      error.name = "CastError";
      (User.findById as jest.Mock).mockRejectedValue(error);

      // Set an invalid MongoDB ID
      mockRequest.params = { id: "invalid-id-format" };

      await getUserById(mockRequest as Request, mockResponse as Response);

      expect(User.findById).toHaveBeenCalledWith("invalid-id-format");
      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error fetching user",
        error,
      });
    });

    it("should handle errors and return status 500", async () => {
      const error = new Error("Database error");
      (User.findById as jest.Mock).mockRejectedValue(error);

      // Reset params to original value for this test
      mockRequest.params = { id: "mock-user-id" };

      await getUserById(mockRequest as Request, mockResponse as Response);

      expect(User.findById).toHaveBeenCalledWith("mock-user-id");
      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error fetching user",
        error,
      });
    });
  });

  describe("updateUserById", () => {
    it("should update a user and return status 200 when user exists", async () => {
      const mockUser = {
        _id: "mock-user-id",
        email: "updated@example.com",
        role: UserRole.Manager,
      };

      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUser);

      await updateUserById(mockRequest as Request, mockResponse as Response);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "mock-user-id",
        { email: "test@example.com", role: UserRole.User },
        { new: true, runValidators: true }
      );
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({
        message: "User updated",
        user: mockUser,
      });
    });

    it("should return a 404 status when user does not exist", async () => {
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      await updateUserById(mockRequest as Request, mockResponse as Response);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "mock-user-id",
        { email: "test@example.com", role: UserRole.User },
        { new: true, runValidators: true }
      );
      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should handle validation errors and return status 500", async () => {
      const error = new Error("Validation failed: email: Invalid email format");
      (User.findByIdAndUpdate as jest.Mock).mockRejectedValue(error);

      // Set invalid email to trigger validation error
      mockRequest.body = {
        email: "invalid-email",
        role: UserRole.User,
      };

      await updateUserById(mockRequest as Request, mockResponse as Response);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "mock-user-id",
        { email: "invalid-email", role: UserRole.User },
        { new: true, runValidators: true }
      );
      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error updating user",
        error,
      });
    });

    it("should handle errors and return status 500", async () => {
      const error = new Error("Database error");
      (User.findByIdAndUpdate as jest.Mock).mockRejectedValue(error);

      // Reset the body to the original value for this test
      mockRequest.body = {
        email: "test@example.com",
        role: UserRole.User,
      };

      await updateUserById(mockRequest as Request, mockResponse as Response);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "mock-user-id",
        { email: "test@example.com", role: UserRole.User },
        { new: true, runValidators: true }
      );
      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error updating user",
        error,
      });
    });
  });

  describe("deleteUserById", () => {
    it("should delete a user and return status 200 when user exists", async () => {
      const mockUser = {
        _id: "mock-user-id",
        email: "user@example.com",
        role: UserRole.User,
      };
      (User.findByIdAndDelete as jest.Mock).mockResolvedValue(mockUser);

      await deleteUserById(mockRequest as Request, mockResponse as Response);

      expect(User.findByIdAndDelete).toHaveBeenCalledWith("mock-user-id");
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({
        message: "User deleted successfully",
      });
    });

    it("should return a 404 status when user does not exist", async () => {
      (User.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

      await deleteUserById(mockRequest as Request, mockResponse as Response);

      expect(User.findByIdAndDelete).toHaveBeenCalledWith("mock-user-id");
      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should handle errors and return status 500", async () => {
      const error = new Error("Database error");
      (User.findByIdAndDelete as jest.Mock).mockRejectedValue(error);

      await deleteUserById(mockRequest as Request, mockResponse as Response);

      expect(User.findByIdAndDelete).toHaveBeenCalledWith("mock-user-id");
      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error deleting user",
        error,
      });
    });
  });
});
