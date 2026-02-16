import request from "supertest";
import express, { Express } from "express";
import authRoutes from "../auth";
import { login, register, refresh, logout } from "@controllers";
import { validateApiKey, authenticate } from "@middleware";

jest.mock("@controllers", () => ({
  login: jest.fn((req, res) => {
    if (!req.body.email || !req.body.password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    return res
      .status(200)
      .json({
        message: "Login successful",
        accessToken: "test-token",
        refreshToken: "test-refresh",
      });
  }),
  register: jest.fn((req, res) => {
    if (!req.body.email || !req.body.password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    return res.status(201).json({ message: `User registered with email ${req.body.email}` });
  }),
  refresh: jest.fn((req, res) => {
    if (!req.body.refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }
    return res.status(200).json({ accessToken: "new-token", refreshToken: "new-refresh" });
  }),
  logout: jest.fn((req, res) => {
    return res.status(200).json({ message: "Logged out" });
  }),
}));

jest.mock("@middleware", () => ({
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
    req.user = {
      id: "user123",
      email: "test@example.com",
      role: "member",
      projectId: "project-123",
      membershipId: "m123",
    };
    next();
  }),
}));

describe("Auth Routes", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/auth", authRoutes);
    jest.clearAllMocks();
  });

  describe("POST /auth/login", () => {
    it("should return 401 if API key is missing", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({ email: "test@example.com", password: "password123" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: "API key is required" });
      expect(validateApiKey).toHaveBeenCalled();
      expect(login).not.toHaveBeenCalled();
    });

    it("should return 401 if API key is invalid", async () => {
      const response = await request(app)
        .post("/auth/login")
        .set("x-api-key", "invalid-key")
        .send({ email: "test@example.com", password: "password123" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: "Invalid API key" });
    });

    it("should return 400 if email or password is missing", async () => {
      const response = await request(app)
        .post("/auth/login")
        .set("x-api-key", "valid-api-key")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(400);
      expect(login).toHaveBeenCalled();
    });

    it("should return 200 and tokens on successful login", async () => {
      const response = await request(app)
        .post("/auth/login")
        .set("x-api-key", "valid-api-key")
        .send({ email: "test@example.com", password: "password123" });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });
  });

  describe("POST /auth/register", () => {
    it("should return 401 if API key is missing", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({ email: "test@example.com", password: "password123" });

      expect(response.status).toBe(401);
      expect(register).not.toHaveBeenCalled();
    });

    it("should return 400 if email or password is missing", async () => {
      const response = await request(app)
        .post("/auth/register")
        .set("x-api-key", "valid-api-key")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(400);
      expect(register).toHaveBeenCalled();
    });

    it("should return 201 on successful registration", async () => {
      const response = await request(app)
        .post("/auth/register")
        .set("x-api-key", "valid-api-key")
        .send({ email: "test@example.com", password: "password123" });

      expect(response.status).toBe(201);
    });
  });

  describe("POST /auth/refresh", () => {
    it("should return 401 if API key is missing", async () => {
      const response = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: "some-token" });

      expect(response.status).toBe(401);
    });

    it("should return 200 with new tokens on valid refresh", async () => {
      const response = await request(app)
        .post("/auth/refresh")
        .set("x-api-key", "valid-api-key")
        .send({ refreshToken: "valid-refresh-token" });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });
  });

  describe("POST /auth/logout", () => {
    it("should return 200 on successful logout", async () => {
      const response = await request(app)
        .post("/auth/logout")
        .set("Authorization", "Bearer test-token")
        .send({ refreshToken: "some-token" });

      expect(response.status).toBe(200);
      expect(authenticate).toHaveBeenCalled();
      expect(logout).toHaveBeenCalled();
    });
  });
});
