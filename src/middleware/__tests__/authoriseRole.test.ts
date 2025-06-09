import { Response, NextFunction } from "express";
import { authoriseRole } from "../authoriseRole";
import { AuthRequest, UserRole } from "../../types";

describe("Authorise Role Middleware", () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    // Mock response object
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });

    mockRequest = {};

    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };

    nextFunction = jest.fn();

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it("should return 403 if user role is not provided", () => {
    // No user property in request
    const authorizeFn = authoriseRole([UserRole.Admin]);
    authorizeFn(
      mockRequest as AuthRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(responseStatus).toHaveBeenCalledWith(403);
    expect(responseJson).toHaveBeenCalledWith({
      message: "Access denied. No role provided.",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should return 403 if user role is not included in allowed roles", () => {
    mockRequest.user = { role: UserRole.User };
    const authorizeFn = authoriseRole([UserRole.Admin]);

    authorizeFn(
      mockRequest as AuthRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(responseStatus).toHaveBeenCalledWith(403);
    expect(responseJson).toHaveBeenCalledWith({
      message: "Access denied. Insufficient permissions.",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should call next if user role is included in allowed roles", () => {
    mockRequest.user = { role: UserRole.Admin };
    const authorizeFn = authoriseRole([UserRole.Admin, UserRole.Manager]);

    authorizeFn(
      mockRequest as AuthRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalled();
    expect(responseStatus).not.toHaveBeenCalled();
  });

  it("should work with multiple allowed roles", () => {
    mockRequest.user = { role: UserRole.Manager };
    const authorizeFn = authoriseRole([UserRole.Admin, UserRole.Manager]);

    authorizeFn(
      mockRequest as AuthRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalled();
    expect(responseStatus).not.toHaveBeenCalled();
  });
});
