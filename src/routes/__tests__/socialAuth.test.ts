import request from "supertest";
import express, { Express, Request, Response, NextFunction } from "express";
import socialAuthRoutes from "../socialAuth";
import { validateApiKey, authenticate } from "@middleware";
import {
  socialLogin,
  linkSocialAccount,
  unlinkSocialAccount,
  listSocialAccounts,
} from "@controllers";

jest.mock("@middleware", () => ({
  validateApiKey: jest.fn((req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      return res.status(401).json({ message: "API key is required" });
    }
    (req as any).projectId = "project-123";
    next();
  }),
  authenticate: jest.fn((req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing or invalid token" });
    }
    (req as any).user = {
      id: "user-123",
      email: "test@example.com",
      role: "member",
      projectId: "project-123",
      membershipId: "m123",
    };
    next();
  }),
}));

jest.mock("@controllers", () => ({
  socialLogin: jest.fn((req, res) =>
    res.status(200).json({ message: "Login successful", accessToken: "token" })
  ),
  linkSocialAccount: jest.fn((req, res) =>
    res.status(201).json({ message: "Account linked" })
  ),
  unlinkSocialAccount: jest.fn((req, res) =>
    res.status(200).json({ message: "Account unlinked" })
  ),
  listSocialAccounts: jest.fn((req, res) =>
    res.status(200).json({ accounts: [] })
  ),
}));

describe("Social Auth Routes", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/auth/social", socialAuthRoutes);
    jest.clearAllMocks();
  });

  describe("POST /auth/social/login", () => {
    it("should return 401 without API key", async () => {
      const response = await request(app)
        .post("/auth/social/login")
        .send({ provider: "google", code: "code", redirectUri: "http://localhost" });

      expect(response.status).toBe(401);
      expect(socialLogin).not.toHaveBeenCalled();
    });

    it("should return 200 with valid API key", async () => {
      const response = await request(app)
        .post("/auth/social/login")
        .set("x-api-key", "valid-key")
        .send({ provider: "google", code: "code", redirectUri: "http://localhost" });

      expect(response.status).toBe(200);
      expect(validateApiKey).toHaveBeenCalled();
      expect(socialLogin).toHaveBeenCalled();
    });
  });

  describe("POST /auth/social/link", () => {
    it("should return 401 without Bearer token", async () => {
      const response = await request(app)
        .post("/auth/social/link")
        .send({ provider: "github", code: "code", redirectUri: "http://localhost" });

      expect(response.status).toBe(401);
      expect(linkSocialAccount).not.toHaveBeenCalled();
    });

    it("should return 201 with valid Bearer token", async () => {
      const response = await request(app)
        .post("/auth/social/link")
        .set("Authorization", "Bearer test-token")
        .send({ provider: "github", code: "code", redirectUri: "http://localhost" });

      expect(response.status).toBe(201);
      expect(authenticate).toHaveBeenCalled();
      expect(linkSocialAccount).toHaveBeenCalled();
    });
  });

  describe("DELETE /auth/social/unlink/:provider", () => {
    it("should return 401 without Bearer token", async () => {
      const response = await request(app)
        .delete("/auth/social/unlink/google");

      expect(response.status).toBe(401);
      expect(unlinkSocialAccount).not.toHaveBeenCalled();
    });

    it("should return 200 with valid Bearer token", async () => {
      const response = await request(app)
        .delete("/auth/social/unlink/google")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(authenticate).toHaveBeenCalled();
      expect(unlinkSocialAccount).toHaveBeenCalled();
    });
  });

  describe("GET /auth/social/accounts", () => {
    it("should return 401 without Bearer token", async () => {
      const response = await request(app)
        .get("/auth/social/accounts");

      expect(response.status).toBe(401);
      expect(listSocialAccounts).not.toHaveBeenCalled();
    });

    it("should return 200 with valid Bearer token", async () => {
      const response = await request(app)
        .get("/auth/social/accounts")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(authenticate).toHaveBeenCalled();
      expect(listSocialAccounts).toHaveBeenCalled();
    });
  });
});
