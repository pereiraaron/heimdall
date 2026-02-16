import { Response } from "express";
import { User, UserProjectMembership, Project, SocialAccount } from "../models";
import {
  ApiKeyRequest,
  AuthRequest,
  SocialProvider,
  MembershipRole,
  MembershipStatus,
  ISocialProviderConfig,
} from "../types";
import { createTokenPair } from "./auth";
import { exchangeCodeForProfile } from "../services/socialProviders";
import { GRANT_ACCESS_TO_ALL_PROJECTS } from "../config/flags";
import { grantAllProjectsAccess } from "../services/grantAllProjectsAccess";

const VALID_PROVIDERS = Object.values(SocialProvider) as string[];

const getProviderConfig = (
  project: InstanceType<typeof Project>,
  provider: SocialProvider
): ISocialProviderConfig | null => {
  const config = project.socialProviders?.[provider];
  if (!config?.enabled || !config?.clientId || !config?.clientSecret) {
    return null;
  }
  return config;
};

export const socialLogin = async (req: ApiKeyRequest, res: Response) => {
  const { provider, code, redirectUri } = req.body;
  const projectId = req.projectId!;

  if (!provider || !code || !redirectUri) {
    res.status(400).json({ message: "Provider, code, and redirectUri are required" });
    return;
  }

  if (!VALID_PROVIDERS.includes(provider)) {
    res.status(400).json({ message: `Unsupported provider: ${provider}` });
    return;
  }

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const config = getProviderConfig(project, provider as SocialProvider);
    if (!config) {
      res.status(400).json({ message: `${provider} is not enabled for this project` });
      return;
    }

    const profile = await exchangeCodeForProfile(
      provider as SocialProvider,
      code,
      redirectUri,
      config
    );

    // Check if this social account is already linked
    const existingAccount = await SocialAccount.findOne({
      provider,
      providerUserId: profile.providerUserId,
    });

    if (existingAccount) {
      // Returning user — log them in
      const user = await User.findById(existingAccount.userId);
      if (!user || !user.isActive) {
        res.status(401).json({ message: "Account is disabled" });
        return;
      }

      const membership = await UserProjectMembership.findOne({
        userId: user._id,
        projectId,
        status: MembershipStatus.Active,
      });

      if (!membership) {
        res.status(403).json({
          message: "Access denied. No active membership for this project.",
        });
        return;
      }

      const { accessToken, refreshToken, expiresAt } = await createTokenPair(
        user._id.toString(),
        user.email,
        membership.role,
        projectId,
        membership._id.toString()
      );

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
      });
      return;
    }

    // Social account not linked yet — check by email
    let user = await User.findOne({ email: profile.email });
    let membership;

    if (user) {
      if (!user.isActive) {
        res.status(401).json({ message: "Account is disabled" });
        return;
      }

      // Check if user has membership for this project
      membership = await UserProjectMembership.findOne({
        userId: user._id,
        projectId,
      });

      if (membership) {
        if (membership.status !== MembershipStatus.Active) {
          // Reactivate suspended/pending membership
          membership.status = MembershipStatus.Active;
          membership.joinedAt = new Date();
          await membership.save();
        }
      } else {
        // Create membership for existing user in this project
        membership = await UserProjectMembership.create({
          userId: user._id,
          projectId,
          role: MembershipRole.Member,
          status: MembershipStatus.Active,
          joinedAt: new Date(),
        });
      }
    } else {
      // Create new user without password
      user = await User.create({
        email: profile.email,
        username: profile.displayName,
      });

      membership = await UserProjectMembership.create({
        userId: user._id,
        projectId,
        role: MembershipRole.Member,
        status: MembershipStatus.Active,
        joinedAt: new Date(),
      });
    }

    // Link social account
    await SocialAccount.create({
      provider,
      providerUserId: profile.providerUserId,
      userId: user._id,
      email: profile.email,
      displayName: profile.displayName,
    });

    if (GRANT_ACCESS_TO_ALL_PROJECTS) {
      await grantAllProjectsAccess(user._id.toString());
    }

    const { accessToken, refreshToken, expiresAt } = await createTokenPair(
      user._id.toString(),
      user.email,
      membership.role,
      projectId,
      membership._id.toString()
    );

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
    });
  } catch (error) {
    res.status(500).json({ message: "Social login failed" });
  }
};

export const linkSocialAccount = async (req: AuthRequest, res: Response) => {
  const { provider, code, redirectUri } = req.body;
  const userId = req.user!.id;
  const projectId = req.user!.projectId;

  if (!provider || !code || !redirectUri) {
    res.status(400).json({ message: "Provider, code, and redirectUri are required" });
    return;
  }

  if (!VALID_PROVIDERS.includes(provider)) {
    res.status(400).json({ message: `Unsupported provider: ${provider}` });
    return;
  }

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const config = getProviderConfig(project, provider as SocialProvider);
    if (!config) {
      res.status(400).json({ message: `${provider} is not enabled for this project` });
      return;
    }

    // Check if this provider is already linked to this user
    const existingLink = await SocialAccount.findOne({ provider, userId });
    if (existingLink) {
      res.status(409).json({ message: `${provider} account is already linked` });
      return;
    }

    const profile = await exchangeCodeForProfile(
      provider as SocialProvider,
      code,
      redirectUri,
      config
    );

    // Check if this provider account is linked to a different user
    const existingAccount = await SocialAccount.findOne({
      provider,
      providerUserId: profile.providerUserId,
    });

    if (existingAccount) {
      res.status(409).json({
        message: `This ${provider} account is already linked to another user`,
      });
      return;
    }

    await SocialAccount.create({
      provider,
      providerUserId: profile.providerUserId,
      userId,
      email: profile.email,
      displayName: profile.displayName,
    });

    res.status(201).json({ message: `${provider} account linked successfully` });
  } catch (error) {
    res.status(500).json({ message: "Failed to link social account" });
  }
};

export const unlinkSocialAccount = async (req: AuthRequest, res: Response) => {
  const { provider } = req.params;
  const userId = req.user!.id;

  if (!VALID_PROVIDERS.includes(provider)) {
    res.status(400).json({ message: `Unsupported provider: ${provider}` });
    return;
  }

  try {
    // Ensure user has at least one other auth method
    const user = await User.findById(userId).select("+password");
    const socialAccounts = await SocialAccount.find({ userId });
    const hasPassword = !!user?.password;
    const otherSocialAccounts = socialAccounts.filter((a) => a.provider !== provider);

    if (!hasPassword && otherSocialAccounts.length === 0) {
      res.status(400).json({
        message:
          "Cannot unlink. This is your only authentication method. Set a password or link another provider first.",
      });
      return;
    }

    const deleted = await SocialAccount.findOneAndDelete({
      provider,
      userId,
    });

    if (!deleted) {
      res.status(404).json({ message: `No ${provider} account linked` });
      return;
    }

    res.status(200).json({ message: `${provider} account unlinked successfully` });
  } catch (error) {
    res.status(500).json({ message: "Failed to unlink social account" });
  }
};

export const listSocialAccounts = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const accounts = await SocialAccount.find({ userId }).select(
      "provider email displayName createdAt"
    );

    res.status(200).json({ accounts });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch social accounts" });
  }
};
