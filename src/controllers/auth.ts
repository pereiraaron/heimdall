import { Response } from "express";
import { User } from "../models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ApiKeyRequest } from "../types";

export const login = async (req: ApiKeyRequest, res: Response) => {
  if (!req?.body?.email || !req?.body?.password) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }
  const { email, password } = req.body;
  const projectId = req.projectId!;

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    if (!user.projectIds.includes(projectId)) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, projectId },
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

export const register = async (req: ApiKeyRequest, res: Response) => {
  if (!req?.body?.email || !req?.body?.password) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  const { email, password } = req.body;
  const projectId = req.projectId!;

  try {
    const existingUser = await User.findOne({ email }).select("+password");
    if (existingUser) {
      if (existingUser.projectIds.includes(projectId)) {
        res.status(400).json({ message: "User already exists" });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, existingUser.password);
      if (!isPasswordValid) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }

      existingUser.projectIds.push(projectId);
      await existingUser.save();
      res.status(200).json({ message: "Registration successful" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, projectIds: [projectId] });
    await newUser.save();

    res.status(201).json({ message: `User registered with email ${email}` });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error });
  }
};
