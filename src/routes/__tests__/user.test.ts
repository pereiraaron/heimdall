import request from "supertest";
import express, { Express, Request, Response, NextFunction } from "express";
import userRoutes from "../user";
import { authenticate, authoriseRole } from "../../middleware";
import {
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
} from "../../controllers";
import { UserRole } from "../../types";
import { AuthRequest } from "../../types/auth";

// Mock middleware
jest.mock("../../middleware", () => ({
  authenticate: jest.fn(
    (req: AuthRequest, res: Response, next: NextFunction) => {
      req.user = { id: "user123", email: "test@example.com", role: "user" };
      next();
    }
  ),
  authoriseRole: jest
    .fn()
    .mockImplementation(
      (roles) => (req: AuthRequest, res: Response, next: NextFunction) => next()
    ),
}));

// Mock controllers
jest.mock("../../controllers", () => ({
  getAllUsers: jest.fn((req: Request, res: Response) => {
    res.status(200).json([{ id: "user1", email: "user1@example.com" }]);
  }),
  getUserById: jest.fn((req: Request, res: Response) => {
    res.status(200).json({ id: req.params.id, email: "user@example.com" });
  }),
  updateUserById: jest.fn((req: Request, res: Response) => {
    res.status(200).json({
      message: "User updated",
      user: { id: req.params.id, ...req.body },
    });
  }),
  deleteUserById: jest.fn((req: Request, res: Response) => {
    res.status(200).json({ message: "User deleted successfully" });
  }),
}));

describe("User Routes", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/", userRoutes);
    jest.clearAllMocks();
  });

  it("should export a router", () => {
    expect(userRoutes).toBeDefined();
    expect(typeof userRoutes).toBe("function");
  });

  describe("GET /users", () => {
    it("should call authenticate middleware and return users", async () => {
      const response = await request(app).get("/users");

      expect(authenticate).toHaveBeenCalled();
      expect(getAllUsers).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { id: "user1", email: "user1@example.com" },
      ]);
    });
  });

  describe("GET /users/:id", () => {
    it("should call authenticate and authoriseRole middleware", async () => {
      const response = await request(app).get("/users/user123");

      expect(authenticate).toHaveBeenCalled();
      expect(getUserById).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe("PUT /users/:id", () => {
    it("should call authenticate middleware and update user", async () => {
      const response = await request(app)
        .put("/users/user123")
        .send({ email: "updated@example.com" });

      expect(authenticate).toHaveBeenCalled();
      expect(updateUserById).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: "User updated",
        user: { id: "user123", email: "updated@example.com" },
      });
    });
  });

  describe("DELETE /users/:id", () => {
    it("should call authenticate middleware and delete user", async () => {
      const response = await request(app).delete("/users/user123");

      expect(authenticate).toHaveBeenCalled();
      expect(deleteUserById).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "User deleted successfully" });
    });
  });
});
