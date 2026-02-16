import { Response, NextFunction } from "express";
import { authoriseRole } from "../authoriseRole";
import { AuthRequest, MembershipRole } from "@types";

describe("Authorise Role Middleware", () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });

    mockRequest = {};

    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };

    nextFunction = jest.fn();

    jest.clearAllMocks();
  });

  it("should return 403 if user role is not provided", () => {
    const authorizeFn = authoriseRole([MembershipRole.Admin]);
    authorizeFn(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(responseStatus).toHaveBeenCalledWith(403);
    expect(responseJson).toHaveBeenCalledWith({
      message: "Access denied. No role provided.",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should return 403 if user role is not included in allowed roles", () => {
    mockRequest.user = { role: MembershipRole.Member } as any;
    const authorizeFn = authoriseRole([MembershipRole.Admin]);

    authorizeFn(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(responseStatus).toHaveBeenCalledWith(403);
    expect(responseJson).toHaveBeenCalledWith({
      message: "Access denied. Insufficient permissions.",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should call next if user role is included in allowed roles", () => {
    mockRequest.user = { role: MembershipRole.Admin } as any;
    const authorizeFn = authoriseRole([MembershipRole.Admin, MembershipRole.Manager]);

    authorizeFn(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(responseStatus).not.toHaveBeenCalled();
  });

  it("should work with multiple allowed roles", () => {
    mockRequest.user = { role: MembershipRole.Manager } as any;
    const authorizeFn = authoriseRole([MembershipRole.Admin, MembershipRole.Manager]);

    authorizeFn(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(responseStatus).not.toHaveBeenCalled();
  });

  it("should allow higher roles when lower roles are required", () => {
    mockRequest.user = { role: MembershipRole.Owner } as any;
    const authorizeFn = authoriseRole([MembershipRole.Admin]);

    authorizeFn(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(responseStatus).not.toHaveBeenCalled();
  });
});
