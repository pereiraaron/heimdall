import { Response } from "express";
import crypto from "crypto";
import { User, UserProjectMembership, RefreshToken, PasskeyCredential, Project } from "../models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ApiKeyRequest, AuthRequest, MembershipRole, MembershipStatus } from "../types";
import { GRANT_ACCESS_TO_ALL_PROJECTS } from "../config/flags";
import { grantAllProjectsAccess } from "../services/grantAllProjectsAccess";

const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY_DAYS = 14;

const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString("hex");
};

const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const createTokenPair = async (
  userId: string,
  email: string,
  role: string,
  projectId: string,
  membershipId: string
) => {
  const accessToken = jwt.sign(
    { id: userId, email, role, projectId, membershipId },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshTokenRaw = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshTokenRaw);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await RefreshToken.create({
    token: refreshTokenHash,
    userId,
    projectId,
    membershipId,
    expiresAt,
  });

  return { accessToken, refreshToken: refreshTokenRaw, expiresAt };
};

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

    if (!user.password) {
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

    const { accessToken, refreshToken, expiresAt } = await createTokenPair(
      user._id.toString(),
      user.email,
      membership.role,
      projectId,
      membership._id.toString()
    );

    // Check if passkey setup should be nudged
    let passkeySetupRequired: boolean | undefined;
    const project = await Project.findById(projectId);
    if (project?.passkeyPolicy === "encouraged") {
      const hasPasskeys = await PasskeyCredential.exists({ userId: user._id });
      const optedOut = membership.metadata?.preferences?.passkeyOptedOut === true;
      if (!hasPasskeys && !optedOut) {
        passkeySetupRequired = true;
      }
    }

    res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      user: {
        id: user._id,
        username: user.username,
        role: membership.role,
      },
      ...(passkeySetupRequired && { passkeySetupRequired }),
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
};

export const refresh = async (req: ApiKeyRequest, res: Response) => {
  const { refreshToken } = req.body;
  const projectId = req.projectId!;

  if (!refreshToken) {
    res.status(400).json({ message: "Refresh token is required" });
    return;
  }

  try {
    const tokenHash = hashToken(refreshToken);

    const storedToken = await RefreshToken.findOne({
      token: tokenHash,
      projectId,
      isRevoked: false,
    });

    if (!storedToken) {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    if (storedToken.expiresAt < new Date()) {
      res.status(401).json({ message: "Refresh token expired" });
      return;
    }

    // Revoke old refresh token (rotation)
    storedToken.isRevoked = true;
    await storedToken.save();

    // Verify user and membership still exist and are active
    const membership = await UserProjectMembership.findOne({
      _id: storedToken.membershipId,
      status: MembershipStatus.Active,
    });

    if (!membership) {
      res.status(403).json({ message: "Membership no longer active" });
      return;
    }

    const user = await User.findById(storedToken.userId);
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    // Issue new token pair
    const {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt,
    } = await createTokenPair(
      user._id.toString(),
      user.email,
      membership.role,
      projectId,
      membership._id.toString()
    );

    res.status(200).json({
      accessToken,
      refreshToken: newRefreshToken,
      refreshTokenExpiresAt: expiresAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Token refresh failed" });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ message: "Refresh token is required" });
    return;
  }

  try {
    const tokenHash = hashToken(refreshToken);

    const storedToken = await RefreshToken.findOneAndUpdate(
      { token: tokenHash, isRevoked: false },
      { isRevoked: true },
      { new: true }
    );

    if (!storedToken) {
      res.status(200).json({ message: "Logged out" });
      return;
    }

    res.status(200).json({ message: "Logged out" });
  } catch (error) {
    res.status(500).json({ message: "Logout failed" });
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
        if (!user.password) {
          res.status(401).json({ message: "Invalid credentials" });
          return;
        }
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
      if (!user.password) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }
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

    if (GRANT_ACCESS_TO_ALL_PROJECTS) {
      await grantAllProjectsAccess(user._id.toString());
    }

    res.status(201).json({ message: `User registered with email ${email}` });
  } catch (error) {
    res.status(500).json({ message: "Registration failed" });
  }
};
