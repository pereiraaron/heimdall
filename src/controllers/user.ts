import { Response } from "express";
import { User } from "../models";
import { AuthRequest } from "../types";

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const users = await User.find({ projectIds: projectId });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const user = await User.findOne({ _id: req.params.id, projectIds: projectId });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user", error });
  }
};

export const updateUserById = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const { email, role } = req.body;
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.params.id, projectIds: projectId },
      { email, role },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({ message: "User updated", user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Error updating user", error });
  }
};

export const deleteUserById = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.user?.projectId;
    const deletedUser = await User.findOneAndDelete({ _id: req.params.id, projectIds: projectId });

    if (!deletedUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user", error });
  }
};
