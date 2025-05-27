import { Request, Response } from "express";
import { User } from "../models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const login = async (req: Request, res: Response) => {
  if (!req?.body?.email || !req?.body?.password) {
    res.status(400).json({ message: "Username or password are required" });
    return;
  }
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error });
  }
};

export const register = async (req: Request, res: Response) => {
  if (!req?.body?.email || !req?.body?.password) {
    res.status(400).json({ message: "Username or password are required" });
    return;
  }

  const { email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res
        .status(400)
        .json({ message: `Username with email ${email} already exists` });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: `User registered with email ${email}` });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error });
  }
};
