import { Response } from "express";
import { UserRole, AuthRequest } from "../../types";
import {
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
} from "../user";
import { User } from "../../models";

jest.mock("mongoose", () => {
  const originalModule = jest.requireActual("mongoose");
  return {
    __esModule: true,
    ...originalModule,
    connect: jest.fn().mockResolvedValue(true),
  };
});

jest.mock("../../models", () => ({
  User: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));

describe("User Controller", () => {
  let mockRequest: Partial<AuthRequest>;
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
      user: {
        projectId: "project-123",
      },
    };

    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };

    jest.clearAllMocks();
  });

  describe("getAllUsers", () => {
    it("should return users scoped to project with status 200", async () => {
      const mockUsers = [
        { _id: "1", email: "user1@example.com", role: UserRole.User, projectIds: ["project-123"] },
        { _id: "2", email: "user2@example.com", role: UserRole.Admin, projectIds: ["project-123"] },
      ];

      (User.find as jest.Mock).mockResolvedValue(mockUsers);

      await getAllUsers(mockRequest as AuthRequest, mockResponse as Response);

      expect(User.find).toHaveBeenCalledWith({ projectIds: "project-123" });
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(mockUsers);
    });

    it("should handle errors and return status 500", async () => {
      const error = new Error("Database error");
      (User.find as jest.Mock).mockRejectedValue(error);

      await getAllUsers(mockRequest as AuthRequest, mockResponse as Response);

      expect(User.find).toHaveBeenCalledWith({ projectIds: "project-123" });
      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error fetching users",
        error,
      });
    });
  });

  describe("getUserById", () => {
    it("should return a user with status 200 when user exists in project", async () => {
      const mockUser = {
        _id: "mock-user-id",
        email: "user@example.com",
        role: UserRole.User,
        projectIds: ["project-123"],
      };
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      await getUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(User.findOne).toHaveBeenCalledWith({
        _id: "mock-user-id",
        projectIds: "project-123",
      });
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(mockUser);
    });

    it("should return 404 when user does not exist in project", async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);

      await getUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(User.findOne).toHaveBeenCalledWith({
        _id: "mock-user-id",
        projectIds: "project-123",
      });
      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should handle errors and return status 500", async () => {
      const error = new Error("Database error");
      (User.findOne as jest.Mock).mockRejectedValue(error);

      await getUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error fetching user",
        error,
      });
    });
  });

  describe("updateUserById", () => {
    it("should update a user scoped to project and return status 200", async () => {
      const mockUser = {
        _id: "mock-user-id",
        email: "updated@example.com",
        role: UserRole.Manager,
        projectIds: ["project-123"],
      };

      (User.findOneAndUpdate as jest.Mock).mockResolvedValue(mockUser);

      await updateUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "mock-user-id", projectIds: "project-123" },
        { email: "test@example.com", role: UserRole.User },
        { new: true, runValidators: true }
      );
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({
        message: "User updated",
        user: mockUser,
      });
    });

    it("should return 404 when user does not exist in project", async () => {
      (User.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      await updateUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "mock-user-id", projectIds: "project-123" },
        { email: "test@example.com", role: UserRole.User },
        { new: true, runValidators: true }
      );
      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should handle errors and return status 500", async () => {
      const error = new Error("Database error");
      (User.findOneAndUpdate as jest.Mock).mockRejectedValue(error);

      await updateUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error updating user",
        error,
      });
    });
  });

  describe("deleteUserById", () => {
    it("should delete a user scoped to project and return status 200", async () => {
      const mockUser = {
        _id: "mock-user-id",
        email: "user@example.com",
        role: UserRole.User,
        projectIds: ["project-123"],
      };
      (User.findOneAndDelete as jest.Mock).mockResolvedValue(mockUser);

      await deleteUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(User.findOneAndDelete).toHaveBeenCalledWith({
        _id: "mock-user-id",
        projectIds: "project-123",
      });
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({
        message: "User deleted successfully",
      });
    });

    it("should return 404 when user does not exist in project", async () => {
      (User.findOneAndDelete as jest.Mock).mockResolvedValue(null);

      await deleteUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(User.findOneAndDelete).toHaveBeenCalledWith({
        _id: "mock-user-id",
        projectIds: "project-123",
      });
      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: "User not found" });
    });

    it("should handle errors and return status 500", async () => {
      const error = new Error("Database error");
      (User.findOneAndDelete as jest.Mock).mockRejectedValue(error);

      await deleteUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error deleting user",
        error,
      });
    });
  });
});
