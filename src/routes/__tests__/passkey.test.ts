import request from "supertest";
import express, { Express } from "express";
import passkeyRoutes from "../passkey";
import {
  generateRegistrationOptions,
  verifyRegistration,
  generateAuthenticationOptions,
  verifyAuthentication,
  listCredentials,
  updateCredential,
  deleteCredential,
  optOutPasskey,
} from "../../controllers";
import { authenticate, validateApiKey } from "../../middleware";

jest.mock("../../controllers", () => ({
  generateRegistrationOptions: jest.fn((req, res) =>
    res.status(200).json({ options: {}, challengeId: "ch-123" })
  ),
  verifyRegistration: jest.fn((req, res) =>
    res.status(201).json({ message: "Passkey registered successfully" })
  ),
  generateAuthenticationOptions: jest.fn((req, res) =>
    res.status(200).json({ options: {}, challengeId: "ch-456" })
  ),
  verifyAuthentication: jest.fn((req, res) =>
    res.status(200).json({ message: "Login successful", accessToken: "token" })
  ),
  listCredentials: jest.fn((req, res) => res.status(200).json({ credentials: [] })),
  updateCredential: jest.fn((req, res) =>
    res.status(200).json({ credential: { name: "Updated" } })
  ),
  deleteCredential: jest.fn((req, res) => res.status(204).send()),
  optOutPasskey: jest.fn((req, res) => res.status(200).json({ message: "Opted out" })),
  // Other controller exports needed by the barrel
  login: jest.fn(),
  register: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  createTokenPair: jest.fn(),
  getAllUsers: jest.fn(),
  getUserById: jest.fn(),
  updateUserById: jest.fn(),
  deleteUserById: jest.fn(),
  getProjectMembers: jest.fn(),
  getMemberById: jest.fn(),
  inviteMember: jest.fn(),
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
  leaveProject: jest.fn(),
  acceptInvitation: jest.fn(),
  updateMemberMetadata: jest.fn(),
}));

jest.mock("../../middleware", () => ({
  validateApiKey: jest.fn((req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      return res.status(401).json({ message: "API key is required" });
    }
    if (apiKey !== "valid-api-key") {
      return res.status(401).json({ message: "Invalid API key" });
    }
    req.projectId = "project-123";
    next();
  }),
  authenticate: jest.fn((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing or invalid token" });
    }
    req.user = {
      id: "user123",
      email: "test@example.com",
      role: "member",
      projectId: "project-123",
      membershipId: "m123",
    };
    next();
  }),
  authoriseRole: jest.fn(),
  validateMembership: jest.fn(),
  requireRole: jest.fn(),
}));

describe("Passkey Routes", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/auth/passkey", passkeyRoutes);
    jest.clearAllMocks();
  });

  describe("POST /auth/passkey/register/options", () => {
    it("should return 401 without Bearer token", async () => {
      const response = await request(app).post("/auth/passkey/register/options");

      expect(response.status).toBe(401);
      expect(authenticate).toHaveBeenCalled();
      expect(generateRegistrationOptions).not.toHaveBeenCalled();
    });

    it("should return 200 with valid Bearer token", async () => {
      const response = await request(app)
        .post("/auth/passkey/register/options")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(authenticate).toHaveBeenCalled();
      expect(generateRegistrationOptions).toHaveBeenCalled();
    });
  });

  describe("POST /auth/passkey/register/verify", () => {
    it("should return 401 without Bearer token", async () => {
      const response = await request(app)
        .post("/auth/passkey/register/verify")
        .send({ challengeId: "ch-123", credential: {} });

      expect(response.status).toBe(401);
      expect(verifyRegistration).not.toHaveBeenCalled();
    });

    it("should return 201 with valid Bearer token", async () => {
      const response = await request(app)
        .post("/auth/passkey/register/verify")
        .set("Authorization", "Bearer test-token")
        .send({ challengeId: "ch-123", credential: {} });

      expect(response.status).toBe(201);
      expect(verifyRegistration).toHaveBeenCalled();
    });
  });

  describe("POST /auth/passkey/login/options", () => {
    it("should return 401 without API key", async () => {
      const response = await request(app).post("/auth/passkey/login/options");

      expect(response.status).toBe(401);
      expect(validateApiKey).toHaveBeenCalled();
      expect(generateAuthenticationOptions).not.toHaveBeenCalled();
    });

    it("should return 200 with valid API key", async () => {
      const response = await request(app)
        .post("/auth/passkey/login/options")
        .set("x-api-key", "valid-api-key");

      expect(response.status).toBe(200);
      expect(generateAuthenticationOptions).toHaveBeenCalled();
    });
  });

  describe("POST /auth/passkey/login/verify", () => {
    it("should return 401 without API key", async () => {
      const response = await request(app)
        .post("/auth/passkey/login/verify")
        .send({ challengeId: "ch-123", credential: {} });

      expect(response.status).toBe(401);
      expect(verifyAuthentication).not.toHaveBeenCalled();
    });

    it("should return 200 with valid API key", async () => {
      const response = await request(app)
        .post("/auth/passkey/login/verify")
        .set("x-api-key", "valid-api-key")
        .send({ challengeId: "ch-123", credential: {} });

      expect(response.status).toBe(200);
      expect(verifyAuthentication).toHaveBeenCalled();
    });
  });

  describe("GET /auth/passkey/credentials", () => {
    it("should return 401 without Bearer token", async () => {
      const response = await request(app).get("/auth/passkey/credentials");

      expect(response.status).toBe(401);
      expect(listCredentials).not.toHaveBeenCalled();
    });

    it("should return 200 with valid Bearer token", async () => {
      const response = await request(app)
        .get("/auth/passkey/credentials")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(listCredentials).toHaveBeenCalled();
    });
  });

  describe("PATCH /auth/passkey/credentials/:id", () => {
    it("should return 401 without Bearer token", async () => {
      const response = await request(app)
        .patch("/auth/passkey/credentials/cred-123")
        .send({ name: "New Name" });

      expect(response.status).toBe(401);
      expect(updateCredential).not.toHaveBeenCalled();
    });

    it("should return 200 with valid Bearer token", async () => {
      const response = await request(app)
        .patch("/auth/passkey/credentials/cred-123")
        .set("Authorization", "Bearer test-token")
        .send({ name: "New Name" });

      expect(response.status).toBe(200);
      expect(updateCredential).toHaveBeenCalled();
    });
  });

  describe("DELETE /auth/passkey/credentials/:id", () => {
    it("should return 401 without Bearer token", async () => {
      const response = await request(app).delete("/auth/passkey/credentials/cred-123");

      expect(response.status).toBe(401);
      expect(deleteCredential).not.toHaveBeenCalled();
    });

    it("should return 204 with valid Bearer token", async () => {
      const response = await request(app)
        .delete("/auth/passkey/credentials/cred-123")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(204);
      expect(deleteCredential).toHaveBeenCalled();
    });
  });

  describe("POST /auth/passkey/opt-out", () => {
    it("should return 401 without Bearer token", async () => {
      const response = await request(app).post("/auth/passkey/opt-out");

      expect(response.status).toBe(401);
      expect(optOutPasskey).not.toHaveBeenCalled();
    });

    it("should return 200 with valid Bearer token", async () => {
      const response = await request(app)
        .post("/auth/passkey/opt-out")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(optOutPasskey).toHaveBeenCalled();
    });
  });
});
