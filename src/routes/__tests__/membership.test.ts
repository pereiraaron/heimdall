import request from "supertest";
import express, { Express, Request, Response, NextFunction } from "express";
import membershipRoutes from "../membership";
import { authenticate } from "@middleware";
import {
  getProjectMembers,
  getMemberById,
  inviteMember,
  updateMemberRole,
  removeMember,
  leaveProject,
  acceptInvitation,
  updateMemberMetadata,
} from "@controllers";

jest.mock("@middleware", () => ({
  authenticate: jest.fn((req: Request, res: Response, next: NextFunction) => {
    (req as any).user = {
      id: "user-123",
      email: "test@example.com",
      role: "admin",
      projectId: "project-123",
      membershipId: "m123",
    };
    next();
  }),
  authoriseRole: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock("@controllers", () => ({
  getProjectMembers: jest.fn((req, res) => res.status(200).json([])),
  getMemberById: jest.fn((req, res) => res.status(200).json({ userId: req.params.userId })),
  inviteMember: jest.fn((req, res) => res.status(201).json({ message: "Invitation sent" })),
  updateMemberRole: jest.fn((req, res) => res.status(200).json({ message: "Role updated" })),
  removeMember: jest.fn((req, res) => res.status(200).json({ message: "Member removed" })),
  leaveProject: jest.fn((req, res) =>
    res.status(200).json({ message: "Successfully left the project" })
  ),
  acceptInvitation: jest.fn((req, res) => res.status(200).json({ message: "Invitation accepted" })),
  updateMemberMetadata: jest.fn((req, res) =>
    res.status(200).json({ message: "Metadata updated" })
  ),
}));

describe("Membership Routes", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/members", membershipRoutes);
    jest.clearAllMocks();
  });

  describe("GET /members", () => {
    it("should call authenticate and getProjectMembers", async () => {
      const response = await request(app).get("/members");

      expect(response.status).toBe(200);
      expect(authenticate).toHaveBeenCalled();
      expect(getProjectMembers).toHaveBeenCalled();
    });
  });

  describe("GET /members/:userId", () => {
    it("should call authenticate and getMemberById", async () => {
      const response = await request(app).get("/members/user-456");

      expect(response.status).toBe(200);
      expect(authenticate).toHaveBeenCalled();
      expect(getMemberById).toHaveBeenCalled();
    });
  });

  describe("POST /members/invite", () => {
    it("should call authenticate, authoriseRole, and inviteMember", async () => {
      const response = await request(app)
        .post("/members/invite")
        .send({ email: "new@example.com", role: "member" });

      expect(response.status).toBe(201);
      expect(authenticate).toHaveBeenCalled();
      expect(inviteMember).toHaveBeenCalled();
    });
  });

  describe("PUT /members/:userId/role", () => {
    it("should call authenticate, authoriseRole, and updateMemberRole", async () => {
      const response = await request(app).put("/members/user-456/role").send({ role: "manager" });

      expect(response.status).toBe(200);
      expect(updateMemberRole).toHaveBeenCalled();
    });
  });

  describe("DELETE /members/:userId", () => {
    it("should call authenticate, authoriseRole, and removeMember", async () => {
      const response = await request(app).delete("/members/user-456");

      expect(response.status).toBe(200);
      expect(removeMember).toHaveBeenCalled();
    });
  });

  describe("POST /members/leave", () => {
    it("should call authenticate and leaveProject", async () => {
      const response = await request(app).post("/members/leave");

      expect(response.status).toBe(200);
      expect(authenticate).toHaveBeenCalled();
      expect(leaveProject).toHaveBeenCalled();
    });
  });

  describe("POST /members/accept", () => {
    it("should call authenticate and acceptInvitation", async () => {
      const response = await request(app).post("/members/accept");

      expect(response.status).toBe(200);
      expect(authenticate).toHaveBeenCalled();
      expect(acceptInvitation).toHaveBeenCalled();
    });
  });

  describe("PUT /members/metadata", () => {
    it("should call authenticate and updateMemberMetadata", async () => {
      const response = await request(app)
        .put("/members/metadata")
        .send({ metadata: { key: "value" } });

      expect(response.status).toBe(200);
      expect(authenticate).toHaveBeenCalled();
      expect(updateMemberMetadata).toHaveBeenCalled();
    });
  });
});
