import { Response } from "express";
import {
  generateRegistrationOptions,
  verifyRegistration,
  generateAuthenticationOptions,
  verifyAuthentication,
  listCredentials,
  updateCredential,
  deleteCredential,
  optOutPasskey,
} from "../passkey";
import {
  User,
  UserProjectMembership,
  PasskeyCredential,
  WebAuthnChallenge,
  RefreshToken,
  Project,
} from "@models";
import { AuthRequest, ApiKeyRequest, MembershipRole, MembershipStatus } from "@types";

jest.mock("@models", () => ({
  User: {
    findById: jest.fn(),
    findOne: jest.fn(),
  },
  UserProjectMembership: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  PasskeyCredential: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    create: jest.fn(),
  },
  WebAuthnChallenge: {
    create: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
  RefreshToken: {
    create: jest.fn(),
  },
  Project: {
    findById: jest.fn(),
  },
}));

jest.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("test-access-token"),
}));

const simpleWebAuthn = require("@simplewebauthn/server");

describe("Passkey Controller", () => {
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;
  let responseSend: jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    responseSend = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson, send: responseSend });

    process.env = {
      ...originalEnv,
      JWT_SECRET: "test-secret",
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_RP_NAME: "Heimdall",
      WEBAUTHN_ORIGIN: "http://localhost:3000",
    };
    jest.clearAllMocks();

    // Default: project has no per-project WebAuthn config, falls back to env vars
    (Project.findById as jest.Mock).mockResolvedValue(null);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("generateRegistrationOptions", () => {
    const mockReq: Partial<AuthRequest> = {
      user: {
        id: "user123",
        email: "test@example.com",
        role: MembershipRole.Member,
        projectId: "project-123",
        membershipId: "membership123",
      },
      get: jest.fn(),
    };

    it("should return 200 with registration options", async () => {
      (User.findById as jest.Mock).mockResolvedValueOnce({
        _id: "user123",
        email: "test@example.com",
      });
      (PasskeyCredential.find as jest.Mock).mockResolvedValueOnce([]);
      simpleWebAuthn.generateRegistrationOptions.mockResolvedValueOnce({
        challenge: "test-challenge",
        rp: { name: "Heimdall", id: "localhost" },
      });
      (WebAuthnChallenge.create as jest.Mock).mockResolvedValueOnce({
        _id: "challenge-id-123",
      });

      await generateRegistrationOptions(
        mockReq as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ challenge: "test-challenge" }),
          challengeId: "challenge-id-123",
        })
      );
    });

    it("should return 404 if user not found", async () => {
      (User.findById as jest.Mock).mockResolvedValueOnce(null);

      await generateRegistrationOptions(
        mockReq as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(404);
    });

    it("should return 500 on error", async () => {
      (User.findById as jest.Mock).mockRejectedValueOnce(new Error("DB error"));

      await generateRegistrationOptions(
        mockReq as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("verifyRegistration", () => {
    const mockReq: Partial<AuthRequest> = {
      user: {
        id: "user123",
        email: "test@example.com",
        role: MembershipRole.Member,
        projectId: "project-123",
        membershipId: "membership123",
      },
      body: {
        challengeId: "challenge-id-123",
        credential: { id: "cred-id", response: { transports: ["internal"] } },
        name: "My Passkey",
      },
    };

    it("should return 201 on successful registration", async () => {
      (WebAuthnChallenge.findOneAndDelete as jest.Mock).mockResolvedValueOnce({
        challenge: "test-challenge",
      });
      simpleWebAuthn.verifyRegistrationResponse.mockResolvedValueOnce({
        verified: true,
        registrationInfo: {
          credential: {
            id: "Y3JlZC1pZA",
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
          },
          credentialDeviceType: "multiDevice",
          credentialBackedUp: true,
        },
      });
      (PasskeyCredential.create as jest.Mock).mockResolvedValueOnce({
        _id: "passkey-123",
        name: "My Passkey",
        deviceType: "multiDevice",
        backedUp: true,
      });

      await verifyRegistration(
        mockReq as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Passkey registered successfully",
        })
      );
    });

    it("should return 400 if challengeId or credential is missing", async () => {
      const req: Partial<AuthRequest> = {
        ...mockReq,
        body: {},
      };

      await verifyRegistration(
        req as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(400);
    });

    it("should return 400 if challenge not found", async () => {
      (WebAuthnChallenge.findOneAndDelete as jest.Mock).mockResolvedValueOnce(null);

      await verifyRegistration(
        mockReq as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(400);
    });

    it("should return 400 if verification fails", async () => {
      (WebAuthnChallenge.findOneAndDelete as jest.Mock).mockResolvedValueOnce({
        challenge: "test-challenge",
      });
      simpleWebAuthn.verifyRegistrationResponse.mockResolvedValueOnce({
        verified: false,
      });

      await verifyRegistration(
        mockReq as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(400);
    });
  });

  describe("generateAuthenticationOptions", () => {
    it("should return 200 with authentication options (no email)", async () => {
      const mockReq: Partial<ApiKeyRequest> = {
        body: {},
        projectId: "project-123",
        get: jest.fn(),
      };

      simpleWebAuthn.generateAuthenticationOptions.mockResolvedValueOnce({
        challenge: "auth-challenge",
      });
      (WebAuthnChallenge.create as jest.Mock).mockResolvedValueOnce({
        _id: "challenge-id-456",
      });

      await generateAuthenticationOptions(
        mockReq as ApiKeyRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ challenge: "auth-challenge" }),
          challengeId: "challenge-id-456",
        })
      );
    });

    it("should return 200 with scoped credentials when email provided", async () => {
      const mockReq: Partial<ApiKeyRequest> = {
        body: { email: "test@example.com" },
        projectId: "project-123",
        get: jest.fn(),
      };

      (User.findOne as jest.Mock).mockResolvedValueOnce({
        _id: "user123",
        email: "test@example.com",
      });
      (PasskeyCredential.find as jest.Mock).mockResolvedValueOnce([
        { credentialId: "cred-1", transports: ["internal"] },
      ]);
      simpleWebAuthn.generateAuthenticationOptions.mockResolvedValueOnce({
        challenge: "auth-challenge",
      });
      (WebAuthnChallenge.create as jest.Mock).mockResolvedValueOnce({
        _id: "challenge-id-789",
      });

      await generateAuthenticationOptions(
        mockReq as ApiKeyRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it("should return 500 on error", async () => {
      const mockReq: Partial<ApiKeyRequest> = {
        body: {},
        projectId: "project-123",
        get: jest.fn(),
      };

      simpleWebAuthn.generateAuthenticationOptions.mockRejectedValueOnce(
        new Error("WebAuthn error")
      );

      await generateAuthenticationOptions(
        mockReq as ApiKeyRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("verifyAuthentication", () => {
    const mockReq: Partial<ApiKeyRequest> = {
      body: {
        challengeId: "challenge-id-123",
        credential: { id: "Y3JlZC1pZA", response: {} },
      },
      projectId: "project-123",
    };

    it("should return 200 with tokens on successful passkey login", async () => {
      (WebAuthnChallenge.findOneAndDelete as jest.Mock).mockResolvedValueOnce({
        challenge: "auth-challenge",
      });
      (PasskeyCredential.findOne as jest.Mock).mockResolvedValueOnce({
        credentialId: "Y3JlZC1pZA",
        publicKey: Buffer.from([1, 2, 3]),
        counter: 0,
        transports: ["internal"],
        userId: "user123",
        save: jest.fn(),
      });
      simpleWebAuthn.verifyAuthenticationResponse.mockResolvedValueOnce({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });
      (User.findById as jest.Mock).mockResolvedValueOnce({
        _id: { toString: () => "user123" },
        email: "test@example.com",
        username: "testuser",
      });
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValueOnce({
        _id: { toString: () => "membership123" },
        role: MembershipRole.Member,
        status: MembershipStatus.Active,
      });
      (RefreshToken.create as jest.Mock).mockResolvedValueOnce({});

      await verifyAuthentication(
        mockReq as ApiKeyRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Login successful",
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        })
      );
    });

    it("should return 400 if challengeId or credential is missing", async () => {
      const req: Partial<ApiKeyRequest> = {
        body: {},
        projectId: "project-123",
      };

      await verifyAuthentication(
        req as ApiKeyRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(400);
    });

    it("should return 400 if challenge not found", async () => {
      (WebAuthnChallenge.findOneAndDelete as jest.Mock).mockResolvedValueOnce(null);

      await verifyAuthentication(
        mockReq as ApiKeyRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(400);
    });

    it("should return 401 if credential not recognized", async () => {
      (WebAuthnChallenge.findOneAndDelete as jest.Mock).mockResolvedValueOnce({
        challenge: "auth-challenge",
      });
      (PasskeyCredential.findOne as jest.Mock).mockResolvedValueOnce(null);

      await verifyAuthentication(
        mockReq as ApiKeyRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(401);
    });

    it("should return 401 if verification fails", async () => {
      (WebAuthnChallenge.findOneAndDelete as jest.Mock).mockResolvedValueOnce({
        challenge: "auth-challenge",
      });
      (PasskeyCredential.findOne as jest.Mock).mockResolvedValueOnce({
        credentialId: "Y3JlZC1pZA",
        publicKey: Buffer.from([1, 2, 3]),
        counter: 0,
        transports: ["internal"],
        userId: "user123",
      });
      simpleWebAuthn.verifyAuthenticationResponse.mockResolvedValueOnce({
        verified: false,
      });

      await verifyAuthentication(
        mockReq as ApiKeyRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(401);
    });

    it("should return 403 if no active membership", async () => {
      (WebAuthnChallenge.findOneAndDelete as jest.Mock).mockResolvedValueOnce({
        challenge: "auth-challenge",
      });
      (PasskeyCredential.findOne as jest.Mock).mockResolvedValueOnce({
        credentialId: "Y3JlZC1pZA",
        publicKey: Buffer.from([1, 2, 3]),
        counter: 0,
        transports: ["internal"],
        userId: "user123",
        save: jest.fn(),
      });
      simpleWebAuthn.verifyAuthenticationResponse.mockResolvedValueOnce({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });
      (User.findById as jest.Mock).mockResolvedValueOnce({
        _id: { toString: () => "user123" },
        email: "test@example.com",
      });
      (UserProjectMembership.findOne as jest.Mock).mockResolvedValueOnce(null);

      await verifyAuthentication(
        mockReq as ApiKeyRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(403);
    });
  });

  describe("listCredentials", () => {
    it("should return 200 with credentials list", async () => {
      const mockReq: Partial<AuthRequest> = {
        user: {
          id: "user123",
          email: "test@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership123",
        },
      };

      const mockCredentials = [
        { name: "My Passkey", deviceType: "multiDevice", backedUp: true, createdAt: new Date() },
      ];
      (PasskeyCredential.find as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValueOnce(mockCredentials),
        }),
      });

      await listCredentials(
        mockReq as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({ credentials: mockCredentials });
    });
  });

  describe("updateCredential", () => {
    it("should return 200 on successful update", async () => {
      const mockReq: Partial<AuthRequest> = {
        user: {
          id: "user123",
          email: "test@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership123",
        },
        params: { id: "cred-id-123" },
        body: { name: "Updated Name" },
      };

      const mockUpdated = { name: "Updated Name", deviceType: "multiDevice" };
      (PasskeyCredential.findOneAndUpdate as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(mockUpdated),
      });

      await updateCredential(
        mockReq as unknown as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it("should return 400 if name is missing", async () => {
      const mockReq: Partial<AuthRequest> = {
        user: {
          id: "user123",
          email: "test@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership123",
        },
        body: {},
      };

      await updateCredential(
        mockReq as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(400);
    });

    it("should return 404 if credential not found", async () => {
      const mockReq: Partial<AuthRequest> = {
        user: {
          id: "user123",
          email: "test@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership123",
        },
        params: { id: "nonexistent" },
        body: { name: "Updated Name" },
      };

      (PasskeyCredential.findOneAndUpdate as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });

      await updateCredential(
        mockReq as unknown as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(404);
    });
  });

  describe("deleteCredential", () => {
    it("should return 204 on successful delete", async () => {
      const mockReq: Partial<AuthRequest> = {
        user: {
          id: "user123",
          email: "test@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership123",
        },
        params: { id: "cred-id-123" },
      };

      (PasskeyCredential.findOneAndDelete as jest.Mock).mockResolvedValueOnce({
        _id: "cred-id-123",
      });

      await deleteCredential(
        mockReq as unknown as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(204);
    });

    it("should return 404 if credential not found", async () => {
      const mockReq: Partial<AuthRequest> = {
        user: {
          id: "user123",
          email: "test@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership123",
        },
        params: { id: "nonexistent" },
      };

      (PasskeyCredential.findOneAndDelete as jest.Mock).mockResolvedValueOnce(null);

      await deleteCredential(
        mockReq as unknown as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(404);
    });
  });

  describe("optOutPasskey", () => {
    it("should return 200 on successful opt-out", async () => {
      const mockReq: Partial<AuthRequest> = {
        user: {
          id: "user123",
          email: "test@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership123",
        },
      };

      (UserProjectMembership.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({
        metadata: { preferences: { passkeyOptedOut: true } },
      });

      await optOutPasskey(
        mockReq as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({
        message: "Opted out of passkey enrollment",
      });
    });

    it("should return 404 if membership not found", async () => {
      const mockReq: Partial<AuthRequest> = {
        user: {
          id: "user123",
          email: "test@example.com",
          role: MembershipRole.Member,
          projectId: "project-123",
          membershipId: "membership123",
        },
      };

      (UserProjectMembership.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(null);

      await optOutPasskey(
        mockReq as AuthRequest,
        { status: responseStatus } as unknown as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(404);
    });
  });
});
