import { Response, NextFunction } from "express";
import { authenticate } from "../authenticate";
import { AuthRequest } from "../../types";
import jwt from "jsonwebtoken";

jest.mock("jsonwebtoken");

describe("Authentication Middleware", () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    // Mock response object
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };

    nextFunction = jest.fn();

    // Set JWT Secret for tests
    process.env = { ...originalEnv, JWT_SECRET: "test-secret-key" };

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it("should return 401 if authorization header is missing", () => {
    authenticate(
      mockRequest as AuthRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(responseStatus).toHaveBeenCalledWith(401);
    expect(responseJson).toHaveBeenCalledWith({
      message: "Missing or invalid token",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should return 401 if authorization header does not start with 'Bearer '", () => {
    mockRequest.headers = { authorization: "InvalidToken" };

    authenticate(
      mockRequest as AuthRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(responseStatus).toHaveBeenCalledWith(401);
    expect(responseJson).toHaveBeenCalledWith({
      message: "Missing or invalid token",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should return 401 if token verification fails", () => {
    mockRequest.headers = { authorization: "Bearer invalidtoken" };
    (jwt.verify as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Invalid token");
    });

    authenticate(
      mockRequest as AuthRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(responseStatus).toHaveBeenCalledWith(401);
    expect(responseJson).toHaveBeenCalledWith({
      message: "Token expired or invalid",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should set user object in request and call next if token is valid", () => {
    mockRequest.headers = { authorization: "Bearer validtoken" };
    const decodedUser = {
      id: "user123",
      email: "test@example.com",
      role: "user",
    };
    (jwt.verify as jest.Mock).mockReturnValueOnce(decodedUser);

    authenticate(
      mockRequest as AuthRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(jwt.verify).toHaveBeenCalledWith("validtoken", "test-secret-key");
    expect(mockRequest.user).toEqual(decodedUser);
    expect(nextFunction).toHaveBeenCalled();
    expect(responseStatus).not.toHaveBeenCalled();
  });

});
