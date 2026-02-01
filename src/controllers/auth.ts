import { Response } from "express";
import { User, UserProjectMembership } from "../models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ApiKeyRequest, MembershipRole, MembershipStatus } from "../types";

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

    // Check membership for this project
    const membership = await UserProjectMembership.findOne({
      userId: user._id,
      projectId,
      status: MembershipStatus.Active,
    });

    if (!membership) {
      res.status(403).json({ message: "Access denied. No active membership for this project." });
      return;
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: membership.role,
        projectId,
        membershipId: membership._id,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        role: membership.role,
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
    let user = await User.findOne({ email }).select("+password");

    if (user) {
      // Check if user already has membership for this project
      const existingMembership = await UserProjectMembership.findOne({
        userId: user._id,
        projectId,
      });

      if (existingMembership) {
        if (existingMembership.status === MembershipStatus.Active) {
          res.status(400).json({ message: "User already registered for this project" });
          return;
        }
        // Reactivate suspended/pending membership
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          res.status(401).json({ message: "Invalid credentials" });
          return;
        }
        existingMembership.status = MembershipStatus.Active;
        existingMembership.joinedAt = new Date();
        await existingMembership.save();
        res.status(200).json({ message: `User registered with email ${email}` });
        return;
      }

      // Validate password for existing user joining new project
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await User.create({ email, password: hashedPassword });
    }

    // Create membership for the project
    await UserProjectMembership.create({
      userId: user._id,
      projectId,
      role: MembershipRole.Member,
      status: MembershipStatus.Active,
      joinedAt: new Date(),
    });

    res.status(201).json({ message: `User registered with email ${email}` });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error });
  }
};
