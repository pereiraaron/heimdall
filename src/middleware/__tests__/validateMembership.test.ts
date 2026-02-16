import { Response, NextFunction } from "express";
import { validateMembership } from "../validateMembership";
import { UserProjectMembership } from "@models";
import { AuthRequest, MembershipRole, MembershipStatus } from "@types";

jest.mock("@models", () => ({
  UserProjectMembership: {
    findOne: jest.fn(),
  },
}));

describe("validateMembership Middleware", () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });
    nextFunction = jest.fn();

    mockRequest = {
      user: {
        id: "user-123",
        email: "test@example.com",
        role: MembershipRole.Member,
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

  it("should return 401 if userId is missing", async () => {
    mockRequest.user = {
      id: "",
      email: "",
      role: MembershipRole.Member,
      projectId: "project-123",
      membershipId: "",
    };

    const middleware = validateMembership();
    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(responseStatus).toHaveBeenCalledWith(401);
    expect(responseJson).toHaveBeenCalledWith({ message: "Authentication required" });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should return 401 if projectId is missing", async () => {
    mockRequest.user = {
      id: "user-123",
      email: "",
      role: MembershipRole.Member,
      projectId: "",
      membershipId: "",
    };

    const middleware = validateMembership();
    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(responseStatus).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should return 403 if no active membership found", async () => {
    (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(null);

    const middleware = validateMembership();
    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(responseStatus).toHaveBeenCalledWith(403);
    expect(responseJson).toHaveBeenCalledWith({
      message: "No active membership for this project",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should call next when membership exists and no roles required", async () => {
    const mockMembership = {
      role: MembershipRole.Member,
    };
    (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(mockMembership);

    const middleware = validateMembership();
    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockRequest.user!.membership).toBe(mockMembership);
    expect(mockRequest.user!.role).toBe(MembershipRole.Member);
  });

  it("should call next when user has sufficient role", async () => {
    const mockMembership = {
      role: MembershipRole.Admin,
    };
    (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(mockMembership);

    const middleware = validateMembership([MembershipRole.Admin]);
    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });

  it("should return 403 if user has insufficient role", async () => {
    const mockMembership = {
      role: MembershipRole.Member,
    };
    (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(mockMembership);

    const middleware = validateMembership([MembershipRole.Admin]);
    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(responseStatus).toHaveBeenCalledWith(403);
    expect(responseJson).toHaveBeenCalledWith({ message: "Insufficient permissions" });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should allow higher roles when lower roles are required", async () => {
    const mockMembership = {
      role: MembershipRole.Owner,
    };
    (UserProjectMembership.findOne as jest.Mock).mockResolvedValue(mockMembership);

    const middleware = validateMembership([MembershipRole.Member]);
    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });

  it("should return 500 on database error", async () => {
    (UserProjectMembership.findOne as jest.Mock).mockRejectedValue(new Error("DB error"));

    const middleware = validateMembership();
    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(responseStatus).toHaveBeenCalledWith(500);
    expect(responseJson).toHaveBeenCalledWith({ message: "Membership validation failed" });
    expect(nextFunction).not.toHaveBeenCalled();
  });
});
