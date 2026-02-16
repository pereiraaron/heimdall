import { Response } from "express";
import {
  generateRegistrationOptions as generateRegOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions as generateAuthOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import {
  User,
  UserProjectMembership,
  PasskeyCredential,
  WebAuthnChallenge,
  Project,
} from "@models";
import { createTokenPair } from "./auth";
import { AuthRequest, ApiKeyRequest, MembershipStatus } from "@types";

const DEFAULT_RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";
const DEFAULT_RP_NAME = process.env.WEBAUTHN_RP_NAME || "Heimdall";
const DEFAULT_ORIGIN = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";
const CHALLENGE_TTL_SECONDS = 60;

const getWebAuthnConfig = async (projectId: string, requestOrigin?: string) => {
  const project = await Project.findById(projectId);
  const rpName = project?.name || DEFAULT_RP_NAME;

  const rpIds = project?.webauthnRpIds?.length ? project.webauthnRpIds : [DEFAULT_RP_ID];

  // Resolve a single RP ID from the request origin for options generation.
  // The RP ID must be a registrable domain suffix of the origin hostname.
  let rpId = rpIds[0];
  if (requestOrigin && rpIds.length > 1) {
    try {
      const hostname = new URL(requestOrigin).hostname;
      const match = rpIds.find((id) => hostname === id || hostname.endsWith(`.${id}`));
      if (match) rpId = match;
    } catch {
      // Invalid origin, use first RP ID
    }
  }

  let origins: string | string[];
  if (project?.webauthnOrigins && project.webauthnOrigins.length > 0) {
    origins =
      project.webauthnOrigins.length === 1 ? project.webauthnOrigins[0] : project.webauthnOrigins;
  } else {
    const fallback = DEFAULT_ORIGIN.split(",").map((o) => o.trim());
    origins = fallback.length === 1 ? fallback[0] : fallback;
  }

  // For verification, pass all RP IDs so credentials from any domain are accepted
  const expectedRpIds = rpIds.length === 1 ? rpIds[0] : rpIds;

  return { rpId, rpName, origins, expectedRpIds };
};

export const generateRegistrationOptions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.user!.projectId;
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const requestOrigin = req.get("origin");
    const { rpId, rpName } = await getWebAuthnConfig(projectId, requestOrigin);
    const existingCredentials = await PasskeyCredential.find({ userId });

    const options = await generateRegOptions({
      rpName,
      rpID: rpId,
      userID: Buffer.from(userId),
      userName: user.email,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: existingCredentials.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports as AuthenticatorTransport[],
      })),
    });

    const challenge = await WebAuthnChallenge.create({
      challenge: options.challenge,
      userId,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000),
    });

    res.status(200).json({
      options,
      challengeId: challenge._id,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to generate registration options" });
  }
};

export const verifyRegistration = async (req: AuthRequest, res: Response) => {
  const { challengeId, credential, name } = req.body;

  if (!challengeId || !credential) {
    res.status(400).json({ message: "challengeId and credential are required" });
    return;
  }

  try {
    const { expectedRpIds, origins } = await getWebAuthnConfig(req.user!.projectId);

    const challenge = await WebAuthnChallenge.findOneAndDelete({
      _id: challengeId,
      userId: req.user!.id,
    });

    if (!challenge) {
      res.status(400).json({ message: "Challenge not found or expired" });
      return;
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origins,
      expectedRPID: expectedRpIds,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ message: "Passkey verification failed" });
      return;
    }

    const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const passkeyCredential = await PasskeyCredential.create({
      credentialId: credentialID,
      publicKey: Buffer.from(credentialPublicKey),
      counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.response?.transports || [],
      userId: req.user!.id,
      name: name || undefined,
    });

    res.status(201).json({
      message: "Passkey registered successfully",
      credential: {
        id: passkeyCredential._id,
        name: passkeyCredential.name,
        deviceType: passkeyCredential.deviceType,
        backedUp: passkeyCredential.backedUp,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to verify registration" });
  }
};

export const generateAuthenticationOptions = async (req: ApiKeyRequest, res: Response) => {
  try {
    const requestOrigin = req.get("origin");
    const { rpId } = await getWebAuthnConfig(req.projectId!, requestOrigin);
    const { email } = req.body || {};
    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] | undefined;
    let userId: string | undefined;

    if (email) {
      const user = await User.findOne({ email });
      if (user) {
        userId = user._id.toString();
        const credentials = await PasskeyCredential.find({ userId: user._id });
        allowCredentials = credentials.map((cred) => ({
          id: cred.credentialId,
          transports: cred.transports as AuthenticatorTransport[],
        }));
      }
    }

    const options = await generateAuthOptions({
      rpID: rpId,
      userVerification: "preferred",
      allowCredentials,
    });

    const challenge = await WebAuthnChallenge.create({
      challenge: options.challenge,
      userId,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000),
    });

    res.status(200).json({
      options,
      challengeId: challenge._id,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to generate authentication options" });
  }
};

export const verifyAuthentication = async (req: ApiKeyRequest, res: Response) => {
  const { challengeId, credential } = req.body;
  const projectId = req.projectId!;

  if (!challengeId || !credential) {
    res.status(400).json({ message: "challengeId and credential are required" });
    return;
  }

  try {
    const { expectedRpIds, origins } = await getWebAuthnConfig(projectId);

    const challenge = await WebAuthnChallenge.findOneAndDelete({
      _id: challengeId,
    });

    if (!challenge) {
      res.status(400).json({ message: "Challenge not found or expired" });
      return;
    }

    const credentialId = credential.id;
    const storedCredential = await PasskeyCredential.findOne({ credentialId });

    if (!storedCredential) {
      res.status(401).json({ message: "Passkey not recognized" });
      return;
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origins,
      expectedRPID: expectedRpIds,
      authenticator: {
        credentialID: storedCredential.credentialId,
        credentialPublicKey: new Uint8Array(storedCredential.publicKey),
        counter: storedCredential.counter,
        transports: storedCredential.transports as AuthenticatorTransport[],
      },
    });

    if (!verification.verified) {
      res.status(401).json({ message: "Passkey authentication failed" });
      return;
    }

    // Counter anomaly detection
    const { newCounter } = verification.authenticationInfo;
    if (newCounter <= storedCredential.counter && storedCredential.counter !== 0) {
      console.warn(
        `Passkey counter anomaly detected for credential ${storedCredential.credentialId}. ` +
          `Expected > ${storedCredential.counter}, got ${newCounter}. Possible cloned authenticator.`
      );
    }

    // Update counter
    storedCredential.counter = newCounter;
    await storedCredential.save();

    // Look up user and membership
    const user = await User.findById(storedCredential.userId);
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

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
    res.status(500).json({ message: "Passkey authentication failed" });
  }
};

export const listCredentials = async (req: AuthRequest, res: Response) => {
  try {
    const credentials = await PasskeyCredential.find({ userId: req.user!.id })
      .select("name deviceType backedUp createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({ credentials });
  } catch (error) {
    res.status(500).json({ message: "Failed to list credentials" });
  }
};

export const updateCredential = async (req: AuthRequest, res: Response) => {
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ message: "Name is required" });
    return;
  }

  try {
    const credential = await PasskeyCredential.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { name },
      { new: true }
    ).select("name deviceType backedUp createdAt");

    if (!credential) {
      res.status(404).json({ message: "Credential not found" });
      return;
    }

    res.status(200).json({ credential });
  } catch (error) {
    res.status(500).json({ message: "Failed to update credential" });
  }
};

export const deleteCredential = async (req: AuthRequest, res: Response) => {
  try {
    const credential = await PasskeyCredential.findOneAndDelete({
      _id: req.params.id,
      userId: req.user!.id,
    });

    if (!credential) {
      res.status(404).json({ message: "Credential not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Failed to delete credential" });
  }
};

export const optOutPasskey = async (req: AuthRequest, res: Response) => {
  try {
    const membership = await UserProjectMembership.findOneAndUpdate(
      {
        userId: req.user!.id,
        projectId: req.user!.projectId,
        status: MembershipStatus.Active,
      },
      { "metadata.preferences.passkeyOptedOut": true },
      { new: true }
    );

    if (!membership) {
      res.status(404).json({ message: "Active membership not found" });
      return;
    }

    res.status(200).json({ message: "Opted out of passkey enrollment" });
  } catch (error) {
    res.status(500).json({ message: "Failed to opt out" });
  }
};
