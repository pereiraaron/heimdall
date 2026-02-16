import { Response, NextFunction } from "express";
import { validateApiKey } from "../apiKey";
import { Project } from "@models";
import { ApiKeyRequest } from "@types";

jest.mock("@models", () => ({
  Project: {
    findOne: jest.fn(),
  },
}));

describe("API Key Middleware", () => {
  let mockRequest: Partial<ApiKeyRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };

    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  it("should return 401 if API key is missing", async () => {
    await validateApiKey(
      mockRequest as ApiKeyRequest,
      mockResponse as Response,
      mockNext
    );

    expect(responseStatus).toHaveBeenCalledWith(401);
    expect(responseJson).toHaveBeenCalledWith({
      message: "API key is required",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 401 if API key is invalid", async () => {
    mockRequest.headers = { "x-api-key": "invalid-key" };
    (Project.findOne as jest.Mock).mockResolvedValue(null);

    await validateApiKey(
      mockRequest as ApiKeyRequest,
      mockResponse as Response,
      mockNext
    );

    expect(Project.findOne).toHaveBeenCalledWith({ apiKey: "invalid-key" });
    expect(responseStatus).toHaveBeenCalledWith(401);
    expect(responseJson).toHaveBeenCalledWith({
      message: "Invalid API key",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should set projectId and call next on valid API key", async () => {
    mockRequest.headers = { "x-api-key": "hm_valid_key" };
    const mockProject = {
      _id: { toString: () => "project-123" },
      name: "Test Project",
      apiKey: "hm_valid_key",
    };
    (Project.findOne as jest.Mock).mockResolvedValue(mockProject);

    await validateApiKey(
      mockRequest as ApiKeyRequest,
      mockResponse as Response,
      mockNext
    );

    expect(Project.findOne).toHaveBeenCalledWith({ apiKey: "hm_valid_key" });
    expect(mockRequest.projectId).toBe("project-123");
    expect(mockNext).toHaveBeenCalled();
    expect(responseStatus).not.toHaveBeenCalled();
  });

  it("should return 500 on database error", async () => {
    mockRequest.headers = { "x-api-key": "hm_valid_key" };
    (Project.findOne as jest.Mock).mockRejectedValue(new Error("Database error"));

    await validateApiKey(
      mockRequest as ApiKeyRequest,
      mockResponse as Response,
      mockNext
    );

    expect(responseStatus).toHaveBeenCalledWith(500);
    expect(responseJson).toHaveBeenCalledWith({
      message: "API key validation failed",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
