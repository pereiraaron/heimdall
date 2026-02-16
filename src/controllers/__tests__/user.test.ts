import { Response } from "express";
import { MembershipRole, MembershipStatus, AuthRequest } from "@types";
import {
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
} from "../user";
import { User, UserProjectMembership } from "@models";

jest.mock("mongoose", () => {
  const originalModule = jest.requireActual("mongoose");
  return {
    __esModule: true,
    ...originalModule,
    connect: jest.fn().mockResolvedValue(true),
  };
});

jest.mock("@services/cleanupUserData", () => ({
  cleanupOrphanedUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@models", () => ({
  User: {
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
  UserProjectMembership: {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findOneAndDelete: jest.fn(),
    countDocuments: jest.fn(),
    populate: jest.fn(),
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
        username: "testuser",
      },
      user: {
        id: "current-user-id",
        email: "current@example.com",
        role: MembershipRole.Admin,
        projectId: "project-123",
        membershipId: "membership-123",
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
      const mockMemberships = [
        {
          _id: "membership-1",
          userId: { _id: "1", email: "user1@example.com", username: "user1", toObject: () => ({ _id: "1", email: "user1@example.com", username: "user1" }) },
          role: MembershipRole.Member,
          joinedAt: new Date(),
        },
        {
          _id: "membership-2",
          userId: { _id: "2", email: "user2@example.com", username: "user2", toObject: () => ({ _id: "2", email: "user2@example.com", username: "user2" }) },
          role: MembershipRole.Admin,
          joinedAt: new Date(),
        },
      ];

      (UserProjectMembership.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockMemberships),
      });

      await getAllUsers(mockRequest as AuthRequest, mockResponse as Response);

      expect(UserProjectMembership.find).toHaveBeenCalledWith({
        projectId: "project-123",
        status: MembershipStatus.Active,
      });
      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it("should handle errors and return status 500", async () => {
      const error = new Error("Database error");
      (UserProjectMembership.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockRejectedValue(error),
      });

      await getAllUsers(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error fetching users",
      });
    });
  });

  describe("getUserById", () => {
    it("should return a user with status 200 when user exists in project", async () => {
      const mockMembership = {
        _id: "membership-id",
        userId: { _id: "mock-user-id", email: "user@example.com", username: "testuser", toObject: () => ({ _id: "mock-user-id", email: "user@example.com", username: "testuser" }) },
        role: MembershipRole.Member,
        joinedAt: new Date(),
        metadata: {},
      };

      (UserProjectMembership.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockMembership),
      });

      await getUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(UserProjectMembership.findOne).toHaveBeenCalledWith({
        userId: "mock-user-id",
        projectId: "project-123",
        status: MembershipStatus.Active,
      });
      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it("should return 404 when user does not exist in project", async () => {
      (UserProjectMembership.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await getUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: "User not found in this project" });
    });

    it("should handle errors and return status 500", async () => {
      const error = new Error("Database error");
      (UserProjectMembership.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockRejectedValue(error),
      });

      await getUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error fetching user",
      });
    });
  });

  describe("updateUserById", () => {
    it("should update a user and return status 200", async () => {
      const mockMembership = {
        _id: "membership-id",
        role: MembershipRole.Member,
      };

      const mockUpdatedUser = {
        _id: "mock-user-id",
        email: "test@example.com",
        username: "testuser",
        toObject: () => ({ _id: "mock-user-id", email: "test@example.com", username: "testuser" }),
      };

      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(mockMembership);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUpdatedUser);

      await updateUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it("should return 404 when user does not exist in project", async () => {
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(null);

      await updateUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: "User not found in this project" });
    });

    it("should handle errors and return status 500", async () => {
      const error = new Error("Database error");
      (UserProjectMembership.findOne as jest.Mock).mockRejectedValue(error);

      await updateUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error updating user",
      });
    });
  });

  describe("deleteUserById", () => {
    it("should delete a user from project and return status 200", async () => {
      const mockMembership = {
        _id: "membership-id",
        userId: "mock-user-id",
      };

      (UserProjectMembership.findOneAndDelete as jest.Mock).mockResolvedValue(mockMembership);

      await deleteUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(UserProjectMembership.findOneAndDelete).toHaveBeenCalledWith({
        userId: "mock-user-id",
        projectId: "project-123",
      });
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({
        message: "User removed from project successfully",
      });
    });

    it("should return 404 when user does not exist in project", async () => {
      (UserProjectMembership.findOneAndDelete as jest.Mock).mockResolvedValue(null);

      await deleteUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: "User not found in this project" });
    });

    it("should handle errors and return status 500", async () => {
      const error = new Error("Database error");
      (UserProjectMembership.findOneAndDelete as jest.Mock).mockRejectedValue(error);

      await deleteUserById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Error removing user",
      });
    });
  });
});
