import { Response } from "express";
import { User, UserProjectMembership } from "../models";
import { AuthRequest, MembershipStatus } from "../types";
import { cleanupOrphanedUser } from "../services/cleanupUserData";

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;

    // Get all active memberships for this project with user details
    const memberships = await UserProjectMembership.find({
      projectId,
      status: MembershipStatus.Active,
    }).populate("userId", "email username createdAt updatedAt");

    // Transform to user-centric response with membership info
    const users = memberships.map((m) => ({
      ...((m.userId as any)?.toObject() || {}),
      role: m.role,
      membershipId: m._id,
      joinedAt: m.joinedAt,
    }));

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const userId = req.params.id;

    // Find membership for this user in this project
    const membership = await UserProjectMembership.findOne({
      userId,
      projectId,
      status: MembershipStatus.Active,
    }).populate("userId", "email username createdAt updatedAt");

    if (!membership) {
      res.status(404).json({ message: "User not found in this project" });
      return;
    }

    const user = {
      ...((membership.userId as any)?.toObject() || {}),
      role: membership.role,
      membershipId: membership._id,
      joinedAt: membership.joinedAt,
      metadata: membership.metadata,
    };

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user" });
  }
};

export const updateUserById = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const userId = req.params.id;
    const { email, username } = req.body;

    // Verify user is a member of this project
    const membership = await UserProjectMembership.findOne({
      userId,
      projectId,
      status: MembershipStatus.Active,
    });

    if (!membership) {
      res.status(404).json({ message: "User not found in this project" });
      return;
    }

    // Update user details (not role - that's done via membership endpoint)
    const updateData: Record<string, string> = {};
    if (email) updateData.email = email;
    if (username) updateData.username = username;

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      message: "User updated",
      user: {
        ...updatedUser?.toObject(),
        role: membership.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating user" });
  }
};

export const deleteUserById = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const userId = req.params.id;

    // Find and delete membership
    const membership = await UserProjectMembership.findOneAndDelete({
      userId,
      projectId,
    });

    if (!membership) {
      res.status(404).json({ message: "User not found in this project" });
      return;
    }

    await cleanupOrphanedUser(userId);

    res.status(200).json({ message: "User removed from project successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error removing user" });
  }
};
