import request from "supertest";
import express, { Express } from "express";
import authRoutes from "../auth";
import { login, register } from "../../controllers";

// Mock controllers
jest.mock("../../controllers", () => ({
  login: jest.fn((req, res) => {
    if (!req.body.email || !req.body.password) {
      return res
        .status(400)
        .json({ message: "Username or password are required" });
    }
    return res
      .status(200)
      .json({ message: "Login successful", token: "test-token" });
  }),
  register: jest.fn((req, res) => {
    if (!req.body.email || !req.body.password) {
      return res
        .status(400)
        .json({ message: "Username or password are required" });
    }
    return res
      .status(201)
      .json({ message: `User registered with email ${req.body.email}` });
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
    test("should return 400 if email or password is missing", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({ email: "test@example.com" }); // Missing password

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "Username or password are required",
      });
      expect(login).toHaveBeenCalled();
    });

    test("should return 200 and token on successful login", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({ email: "test@example.com", password: "password123" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: "Login successful",
        token: "test-token",
      });
      expect(login).toHaveBeenCalled();
    });
  });

  describe("POST /auth/register", () => {
    test("should return 400 if email or password is missing", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({ email: "test@example.com" }); // Missing password

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "Username or password are required",
      });
      expect(register).toHaveBeenCalled();
    });

    test("should return 201 on successful registration", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({ email: "test@example.com", password: "password123" });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: "User registered with email test@example.com",
      });
      expect(register).toHaveBeenCalled();
    });
  });
});
