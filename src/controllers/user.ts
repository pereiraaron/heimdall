import { Request, Response } from "express";

export const getAllUsers = async (req: Request, res: Response) => {
  res.json({ message: "Fetching all users" });
};

export const getUserById = async (req: Request, res: Response) => {
  res.json({ message: `Fetching user with ID ${req.params.id}` });
};

export const updateUserById = async (req: Request, res: Response) => {
  res.json({ message: `Updating user with ID ${req.params.id}` });
};

export const deleteUserById = async (req: Request, res: Response) => {
  res.json({ message: `Deleting user with ID ${req.params.id}` });
};
