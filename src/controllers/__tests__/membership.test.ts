import { Response } from "express";
import {
  getProjectMembers,
  getMemberById,
  inviteMember,
  updateMemberRole,
  removeMember,
  leaveProject,
  acceptInvitation,
  updateMemberMetadata,
} from "../membership";
import { User, UserProjectMembership } from "../../models";
import { AuthRequest, MembershipRole, MembershipStatus } from "../../types";

jest.mock("../../services/cleanupUserData", () => ({
  cleanupOrphanedUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
}));

jest.mock("mongoose", () => {
  const original = jest.requireActual("mongoose");
  return {
    ...original,
    Types: {
      ...original.Types,
      ObjectId: jest.fn((val: string) => val),
    },
  };
});

jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  UserProjectMembership: {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
    populate: jest.fn(),
  },
}));

describe("Membership Controller", () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });

    mockRequest = {
      user: {
        id: "actor-id",
        email: "actor@example.com",
        role: MembershipRole.Admin,
        projectId: "project-123",
        membershipId: "membership-123",
      },
      params: {},
      body: {},
    };

    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };

    jest.clearAllMocks();
  });

  describe("getProjectMembers", () => {
    it("should return 200 with members list", async () => {
      const mockMembers = [{ userId: "u1", role: MembershipRole.Member }];
      (UserProjectMembership.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockMembers),
      });

      await getProjectMembers(mockRequest as AuthRequest, mockResponse as Response);

      expect(UserProjectMembership.find).toHaveBeenCalledWith({
        projectId: "project-123",
        status: { $in: [MembershipStatus.Active, MembershipStatus.Pending] },
      });
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(mockMembers);
    });

    it("should return 500 on error", async () => {
      (UserProjectMembership.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error("DB error")),
      });

      await getProjectMembers(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({ message: "Error fetching members" });
    });
  });

  describe("getMemberById", () => {
    it("should return 200 with member when found", async () => {
      mockRequest.params = { userId: "target-user-id" };
      const mockMembership = { userId: "target-user-id", role: MembershipRole.Member };
      (UserProjectMembership.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockMembership),
      });

      await getMemberById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(mockMembership);
    });

    it("should return 404 when member not found", async () => {
      mockRequest.params = { userId: "nonexistent-id" };
      (UserProjectMembership.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await getMemberById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: "Member not found" });
    });

    it("should return 500 on error", async () => {
      mockRequest.params = { userId: "target-user-id" };
      (UserProjectMembership.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error("DB error")),
      });

      await getMemberById(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("inviteMember", () => {
    it("should return 400 if email is missing", async () => {
      mockRequest.body = {};

      await inviteMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({ message: "Email is required" });
    });

    it("should return 403 if inviter cannot assign the role", async () => {
      mockRequest.body = { email: "new@example.com", role: MembershipRole.Owner };

      await inviteMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(403);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Cannot assign a role equal or higher than your own",
      });
    });

    it("should return 400 if user is already an active member", async () => {
      mockRequest.body = { email: "existing@example.com", role: MembershipRole.Member };
      (User.findOne as jest.Mock).mockResolvedValue({ _id: "existing-user-id" });
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue({
        status: MembershipStatus.Active,
      });

      await inviteMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({ message: "User is already a member" });
    });

    it("should return 400 if invitation already pending", async () => {
      mockRequest.body = { email: "pending@example.com", role: MembershipRole.Member };
      (User.findOne as jest.Mock).mockResolvedValue({ _id: "pending-user-id" });
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue({
        status: MembershipStatus.Pending,
      });

      await inviteMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({ message: "Invitation already sent" });
    });

    it("should resend invitation for suspended membership", async () => {
      mockRequest.body = { email: "suspended@example.com", role: MembershipRole.Member };
      (User.findOne as jest.Mock).mockResolvedValue({ _id: "suspended-user-id" });
      const mockMembership = {
        status: MembershipStatus.Suspended,
        role: MembershipRole.Member,
        invitedBy: undefined,
        save: jest.fn().mockResolvedValue(undefined),
      };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(mockMembership);

      await inviteMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockMembership.status).toBe(MembershipStatus.Pending);
      expect(mockMembership.save).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it("should create new user and invitation for unknown email", async () => {
      mockRequest.body = { email: "brand-new@example.com", role: MembershipRole.Member };
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue({ _id: "new-user-id" });
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(null);
      const mockCreatedMembership = { _id: "new-membership-id" };
      (UserProjectMembership.create as jest.Mock).mockResolvedValue(mockCreatedMembership);

      await inviteMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(User.create).toHaveBeenCalled();
      expect(UserProjectMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "new-user-id",
          projectId: "project-123",
          role: MembershipRole.Member,
          status: MembershipStatus.Pending,
        })
      );
      expect(responseStatus).toHaveBeenCalledWith(201);
    });

    it("should return 500 on error", async () => {
      mockRequest.body = { email: "error@example.com", role: MembershipRole.Member };
      (User.findOne as jest.Mock).mockRejectedValue(new Error("DB error"));

      await inviteMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("updateMemberRole", () => {
    it("should return 400 if role is missing", async () => {
      mockRequest.params = { userId: "target-id" };
      mockRequest.body = {};

      await updateMemberRole(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({ message: "Role is required" });
    });

    it("should return 404 if member not found", async () => {
      mockRequest.params = { userId: "nonexistent-id" };
      mockRequest.body = { role: MembershipRole.Manager };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(null);

      await updateMemberRole(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
    });

    it("should return 403 when trying to modify owner", async () => {
      mockRequest.params = { userId: "owner-id" };
      mockRequest.body = { role: MembershipRole.Admin };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue({
        role: MembershipRole.Owner,
      });

      await updateMemberRole(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(403);
      expect(responseJson).toHaveBeenCalledWith({ message: "Cannot modify owner's role" });
    });

    it("should return 403 if actor cannot manage current role", async () => {
      mockRequest.params = { userId: "other-admin-id" };
      mockRequest.body = { role: MembershipRole.Member };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue({
        role: MembershipRole.Admin,
      });

      await updateMemberRole(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(403);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Cannot modify a member with equal or higher role",
      });
    });

    it("should return 403 if actor cannot assign new role", async () => {
      mockRequest.params = { userId: "member-id" };
      mockRequest.body = { role: MembershipRole.Owner };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue({
        role: MembershipRole.Member,
      });

      await updateMemberRole(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(403);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Cannot assign a role equal or higher than your own",
      });
    });

    it("should return 200 on successful role update", async () => {
      mockRequest.params = { userId: "member-id" };
      mockRequest.body = { role: MembershipRole.Manager };
      const mockMembership = {
        role: MembershipRole.Member,
        save: jest.fn().mockResolvedValue(undefined),
      };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(mockMembership);

      await updateMemberRole(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockMembership.role).toBe(MembershipRole.Manager);
      expect(mockMembership.save).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it("should return 500 on error", async () => {
      mockRequest.params = { userId: "member-id" };
      mockRequest.body = { role: MembershipRole.Manager };
      (UserProjectMembership.findOne as jest.Mock).mockRejectedValue(new Error("DB error"));

      await updateMemberRole(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("removeMember", () => {
    it("should return 404 if member not found", async () => {
      mockRequest.params = { userId: "nonexistent-id" };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(null);

      await removeMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
    });

    it("should return 403 when trying to remove owner", async () => {
      mockRequest.params = { userId: "owner-id" };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue({
        role: MembershipRole.Owner,
        userId: { toString: () => "owner-id" },
      });

      await removeMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(403);
      expect(responseJson).toHaveBeenCalledWith({ message: "Cannot remove the owner" });
    });

    it("should return 400 when admin tries to remove self", async () => {
      mockRequest.params = { userId: "actor-id" };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue({
        role: MembershipRole.Member,
        userId: { toString: () => "actor-id" },
      });

      await removeMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Use leave endpoint to remove yourself",
      });
    });

    it("should return 403 if actor cannot manage the member", async () => {
      mockRequest.params = { userId: "other-admin-id" };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue({
        role: MembershipRole.Admin,
        userId: { toString: () => "other-admin-id" },
      });

      await removeMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(403);
    });

    it("should return 200 on successful removal", async () => {
      mockRequest.params = { userId: "member-id" };
      const mockMembership = {
        _id: "membership-to-delete",
        role: MembershipRole.Member,
        userId: { toString: () => "member-id" },
      };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(mockMembership);
      (UserProjectMembership.deleteOne as jest.Mock).mockResolvedValue({});

      await removeMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(UserProjectMembership.deleteOne).toHaveBeenCalledWith({
        _id: "membership-to-delete",
      });
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({ message: "Member removed" });
    });

    it("should return 500 on error", async () => {
      mockRequest.params = { userId: "member-id" };
      (UserProjectMembership.findOne as jest.Mock).mockRejectedValue(new Error("DB error"));

      await removeMember(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("leaveProject", () => {
    it("should return 404 if membership not found", async () => {
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(null);

      await leaveProject(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
    });

    it("should return 403 if owner tries to leave", async () => {
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue({
        role: MembershipRole.Owner,
      });

      await leaveProject(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(403);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Owner must transfer ownership before leaving",
      });
    });

    it("should return 200 on successful leave", async () => {
      const mockMembership = {
        _id: "membership-to-delete",
        role: MembershipRole.Member,
      };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(mockMembership);
      (UserProjectMembership.deleteOne as jest.Mock).mockResolvedValue({});

      await leaveProject(mockRequest as AuthRequest, mockResponse as Response);

      expect(UserProjectMembership.deleteOne).toHaveBeenCalledWith({
        _id: "membership-to-delete",
      });
      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it("should return 500 on error", async () => {
      (UserProjectMembership.findOne as jest.Mock).mockRejectedValue(new Error("DB error"));

      await leaveProject(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("acceptInvitation", () => {
    it("should return 404 if no pending invitation", async () => {
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(null);

      await acceptInvitation(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Pending invitation not found",
      });
    });

    it("should return 200 on successful accept", async () => {
      const mockMembership = {
        status: MembershipStatus.Pending,
        joinedAt: undefined as Date | undefined,
        save: jest.fn().mockResolvedValue(undefined),
      };
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(mockMembership);

      await acceptInvitation(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockMembership.status).toBe(MembershipStatus.Active);
      expect(mockMembership.joinedAt).toBeInstanceOf(Date);
      expect(mockMembership.save).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it("should return 500 on error", async () => {
      (UserProjectMembership.findOne as jest.Mock).mockRejectedValue(new Error("DB error"));

      await acceptInvitation(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("updateMemberMetadata", () => {
    it("should return 404 if membership not found", async () => {
      mockRequest.body = { metadata: { key: "value" } };
      (UserProjectMembership.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      await updateMemberMetadata(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
    });

    it("should return 200 on successful update", async () => {
      mockRequest.body = { metadata: { preferences: { theme: "dark" } } };
      const mockMembership = { _id: "m-123", metadata: { preferences: { theme: "dark" } } };
      (UserProjectMembership.findOneAndUpdate as jest.Mock).mockResolvedValue(mockMembership);

      await updateMemberMetadata(mockRequest as AuthRequest, mockResponse as Response);

      expect(UserProjectMembership.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: "actor-id", projectId: "project-123", status: MembershipStatus.Active },
        { $set: { metadata: { preferences: { theme: "dark" } } } },
        { new: true }
      );
      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it("should return 500 on error", async () => {
      mockRequest.body = { metadata: {} };
      (UserProjectMembership.findOneAndUpdate as jest.Mock).mockRejectedValue(
        new Error("DB error")
      );

      await updateMemberMetadata(mockRequest as AuthRequest, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });
});
