import { Response } from "express";
import { Types } from "mongoose";
import { User, UserProjectMembership } from "../models";
import {
  AuthRequest,
  MembershipRole,
  MembershipStatus,
  canManageRole,
} from "../types";

export const getProjectMembers = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;

    const memberships = await UserProjectMembership.find({
      projectId,
      status: { $in: [MembershipStatus.Active, MembershipStatus.Pending] },
    }).populate("userId", "email username");

    res.status(200).json(memberships);
  } catch (error) {
    res.status(500).json({ message: "Error fetching members", error });
  }
};

export const getMemberById = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const { userId } = req.params;

    const membership = await UserProjectMembership.findOne({
      userId,
      projectId,
    }).populate("userId", "email username");

    if (!membership) {
      res.status(404).json({ message: "Member not found" });
      return;
    }

    res.status(200).json(membership);
  } catch (error) {
    res.status(500).json({ message: "Error fetching member", error });
  }
};

export const inviteMember = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const inviterId = req.user?.id;
    const inviterRole = req.user?.role as MembershipRole;
    const { email, role = MembershipRole.Member } = req.body;

    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    // Check if inviter can assign this role
    if (!canManageRole(inviterRole, role as MembershipRole)) {
      res.status(403).json({ message: "Cannot assign a role equal or higher than your own" });
      return;
    }

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, password: "pending-invite" });
    }

    // Check if membership already exists
    const existingMembership = await UserProjectMembership.findOne({
      userId: user._id,
      projectId,
    });

    if (existingMembership) {
      if (existingMembership.status === MembershipStatus.Active) {
        res.status(400).json({ message: "User is already a member" });
        return;
      }
      if (existingMembership.status === MembershipStatus.Pending) {
        res.status(400).json({ message: "Invitation already sent" });
        return;
      }
      // Reactivate suspended membership
      existingMembership.status = MembershipStatus.Pending;
      existingMembership.role = role;
      existingMembership.invitedBy = inviterId ? new Types.ObjectId(inviterId) : undefined;
      await existingMembership.save();
      res.status(200).json({ message: "Invitation resent", membership: existingMembership });
      return;
    }

    const membership = await UserProjectMembership.create({
      userId: user._id,
      projectId,
      role,
      status: MembershipStatus.Pending,
      invitedBy: inviterId,
    });

    res.status(201).json({ message: "Invitation sent", membership });
  } catch (error) {
    res.status(500).json({ message: "Error inviting member", error });
  }
};

export const updateMemberRole = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const actorRole = req.user?.role as MembershipRole;
    const { userId } = req.params;
    const { role: newRole } = req.body;

    if (!newRole) {
      res.status(400).json({ message: "Role is required" });
      return;
    }

    const membership = await UserProjectMembership.findOne({
      userId,
      projectId,
    });

    if (!membership) {
      res.status(404).json({ message: "Member not found" });
      return;
    }

    // Cannot modify owner
    if (membership.role === MembershipRole.Owner) {
      res.status(403).json({ message: "Cannot modify owner's role" });
      return;
    }

    // Check if actor can manage this member's current role
    if (!canManageRole(actorRole, membership.role as MembershipRole)) {
      res.status(403).json({ message: "Cannot modify a member with equal or higher role" });
      return;
    }

    // Check if actor can assign the new role
    if (!canManageRole(actorRole, newRole as MembershipRole)) {
      res.status(403).json({ message: "Cannot assign a role equal or higher than your own" });
      return;
    }

    membership.role = newRole;
    await membership.save();

    res.status(200).json({ message: "Role updated", membership });
  } catch (error) {
    res.status(500).json({ message: "Error updating role", error });
  }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const actorRole = req.user?.role as MembershipRole;
    const actorId = req.user?.id;
    const { userId } = req.params;

    const membership = await UserProjectMembership.findOne({
      userId,
      projectId,
    });

    if (!membership) {
      res.status(404).json({ message: "Member not found" });
      return;
    }

    // Cannot remove owner
    if (membership.role === MembershipRole.Owner) {
      res.status(403).json({ message: "Cannot remove the owner" });
      return;
    }

    // Cannot remove self (except for leaving)
    if (membership.userId.toString() === actorId && actorRole !== MembershipRole.Member) {
      res.status(400).json({ message: "Use leave endpoint to remove yourself" });
      return;
    }

    // Check if actor can manage this member
    if (!canManageRole(actorRole, membership.role as MembershipRole)) {
      res.status(403).json({ message: "Cannot remove a member with equal or higher role" });
      return;
    }

    await UserProjectMembership.deleteOne({ _id: membership._id });

    res.status(200).json({ message: "Member removed" });
  } catch (error) {
    res.status(500).json({ message: "Error removing member", error });
  }
};

export const leaveProject = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const userId = req.user?.id;

    const membership = await UserProjectMembership.findOne({
      userId,
      projectId,
    });

    if (!membership) {
      res.status(404).json({ message: "Membership not found" });
      return;
    }

    // Owner cannot leave without transferring ownership
    if (membership.role === MembershipRole.Owner) {
      res.status(403).json({ message: "Owner must transfer ownership before leaving" });
      return;
    }

    await UserProjectMembership.deleteOne({ _id: membership._id });

    res.status(200).json({ message: "Successfully left the project" });
  } catch (error) {
    res.status(500).json({ message: "Error leaving project", error });
  }
};

export const acceptInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const userId = req.user?.id;

    const membership = await UserProjectMembership.findOne({
      userId,
      projectId,
      status: MembershipStatus.Pending,
    });

    if (!membership) {
      res.status(404).json({ message: "Pending invitation not found" });
      return;
    }

    membership.status = MembershipStatus.Active;
    membership.joinedAt = new Date();
    await membership.save();

    res.status(200).json({ message: "Invitation accepted", membership });
  } catch (error) {
    res.status(500).json({ message: "Error accepting invitation", error });
  }
};

export const updateMemberMetadata = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const userId = req.user?.id;
    const { metadata } = req.body;

    const membership = await UserProjectMembership.findOneAndUpdate(
      { userId, projectId, status: MembershipStatus.Active },
      { $set: { metadata } },
      { new: true }
    );

    if (!membership) {
      res.status(404).json({ message: "Membership not found" });
      return;
    }

    res.status(200).json({ message: "Metadata updated", membership });
  } catch (error) {
    res.status(500).json({ message: "Error updating metadata", error });
  }
};
