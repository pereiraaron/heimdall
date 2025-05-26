import { Request, Response } from "express";
import { User } from "../models";
import bcrypt from "bcrypt";

export const login = async (req: Request, res: Response) => {};

export const register = async (req: Request, res: Response) => {
  const { username, password, role } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: `User registered with ${username}` });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error });
  }
};

export const getProfile = async (req: Request, res: Response) => {};
