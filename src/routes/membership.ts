import { Router } from "express";
import { authenticate, authoriseRole } from "@middleware";
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
import { MembershipRole } from "@types";

const router = Router();

// All routes require authentication
router.use(authenticate);

// List all project members
router.get("/", getProjectMembers);

// Get specific member
router.get("/:userId", getMemberById);

// Invite a new member (Admin+)
router.post("/invite", authoriseRole([MembershipRole.Admin, MembershipRole.Owner]), inviteMember);

// Update member role (Admin+)
router.put(
  "/:userId/role",
  authoriseRole([MembershipRole.Admin, MembershipRole.Owner]),
  updateMemberRole
);

// Remove a member (Admin+)
router.delete(
  "/:userId",
  authoriseRole([MembershipRole.Admin, MembershipRole.Owner]),
  removeMember
);

// Leave project (self)
router.post("/leave", leaveProject);

// Accept invitation
router.post("/accept", acceptInvitation);

// Update own metadata
router.put("/metadata", updateMemberMetadata);

export default router;
