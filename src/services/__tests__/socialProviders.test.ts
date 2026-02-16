import jwt from "jsonwebtoken";
import { exchangeCodeForProfile } from "../socialProviders";
import { SocialProvider } from "../../types";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock("jsonwebtoken", () => ({
  decode: jest.fn(),
  sign: jest.fn().mockReturnValue("mock-apple-client-secret"),
}));

const mockConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  enabled: true,
};

const mockAppleConfig = {
  ...mockConfig,
  teamId: "TEAM123",
  keyId: "KEY123",
  privateKey: "-----BEGIN PRIVATE KEY-----\nmock\n-----END PRIVATE KEY-----",
};

describe("socialProviders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("Google exchange", () => {
    it("should exchange code and return profile", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id_token: "mock-id-token" }),
      });
      (jwt.decode as jest.Mock).mockReturnValue({
        sub: "google-user-123",
        email: "user@gmail.com",
        name: "Test User",
      });

      const result = await exchangeCodeForProfile(
        SocialProvider.Google,
        "auth-code",
        "http://localhost/callback",
        mockConfig
      );

      expect(result).toEqual({
        providerUserId: "google-user-123",
        email: "user@gmail.com",
        displayName: "Test User",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should throw if token exchange fails", async () => {
      mockFetch.mockResolvedValue({ ok: false });

      await expect(
        exchangeCodeForProfile(
          SocialProvider.Google,
          "bad-code",
          "http://localhost/callback",
          mockConfig
        )
      ).rejects.toThrow("Failed to exchange Google authorization code");
    });

    it("should throw if no id_token returned", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(
        exchangeCodeForProfile(
          SocialProvider.Google,
          "auth-code",
          "http://localhost/callback",
          mockConfig
        )
      ).rejects.toThrow("No ID token returned from Google");
    });

    it("should throw if decoded token is invalid", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id_token: "bad-token" }),
      });
      (jwt.decode as jest.Mock).mockReturnValue(null);

      await expect(
        exchangeCodeForProfile(
          SocialProvider.Google,
          "auth-code",
          "http://localhost/callback",
          mockConfig
        )
      ).rejects.toThrow("Invalid Google ID token");
    });
  });

  describe("GitHub exchange", () => {
    it("should exchange code and return profile with public email", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: "gh-token" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 12345,
            email: "user@github.com",
            name: "GH User",
            login: "ghuser",
          }),
        });

      const result = await exchangeCodeForProfile(
        SocialProvider.GitHub,
        "gh-auth-code",
        "http://localhost/callback",
        mockConfig
      );

      expect(result).toEqual({
        providerUserId: "12345",
        email: "user@github.com",
        displayName: "GH User",
      });
    });

    it("should fetch email from emails endpoint if email is private", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: "gh-token" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 12345,
            email: null,
            name: null,
            login: "ghuser",
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([
            { email: "primary@github.com", primary: true, verified: true },
            { email: "other@github.com", primary: false, verified: true },
          ]),
        });

      const result = await exchangeCodeForProfile(
        SocialProvider.GitHub,
        "gh-auth-code",
        "http://localhost/callback",
        mockConfig
      );

      expect(result.email).toBe("primary@github.com");
      expect(result.displayName).toBe("ghuser");
    });

    it("should throw if token exchange fails", async () => {
      mockFetch.mockResolvedValue({ ok: false });

      await expect(
        exchangeCodeForProfile(
          SocialProvider.GitHub,
          "bad-code",
          "http://localhost/callback",
          mockConfig
        )
      ).rejects.toThrow("Failed to exchange GitHub authorization code");
    });

    it("should throw if no access token returned", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(
        exchangeCodeForProfile(
          SocialProvider.GitHub,
          "auth-code",
          "http://localhost/callback",
          mockConfig
        )
      ).rejects.toThrow("No access token returned from GitHub");
    });

    it("should throw if email cannot be retrieved", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: "gh-token" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: 12345,
            email: null,
            name: "GH User",
            login: "ghuser",
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([]),
        });

      await expect(
        exchangeCodeForProfile(
          SocialProvider.GitHub,
          "auth-code",
          "http://localhost/callback",
          mockConfig
        )
      ).rejects.toThrow("Could not retrieve email from GitHub");
    });
  });

  describe("Apple exchange", () => {
    it("should exchange code and return profile", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id_token: "mock-apple-id-token" }),
      });
      (jwt.decode as jest.Mock).mockReturnValue({
        sub: "apple-user-123",
        email: "user@icloud.com",
      });

      const result = await exchangeCodeForProfile(
        SocialProvider.Apple,
        "apple-auth-code",
        "http://localhost/callback",
        mockAppleConfig
      );

      expect(result).toEqual({
        providerUserId: "apple-user-123",
        email: "user@icloud.com",
        displayName: undefined,
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          iss: "TEAM123",
          sub: "test-client-id",
          aud: "https://appleid.apple.com",
        }),
        mockAppleConfig.privateKey,
        expect.objectContaining({ algorithm: "ES256", keyid: "KEY123" })
      );
    });

    it("should throw if token exchange fails", async () => {
      mockFetch.mockResolvedValue({ ok: false });

      await expect(
        exchangeCodeForProfile(
          SocialProvider.Apple,
          "bad-code",
          "http://localhost/callback",
          mockAppleConfig
        )
      ).rejects.toThrow("Failed to exchange Apple authorization code");
    });

    it("should throw if no id_token returned", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(
        exchangeCodeForProfile(
          SocialProvider.Apple,
          "auth-code",
          "http://localhost/callback",
          mockAppleConfig
        )
      ).rejects.toThrow("No ID token returned from Apple");
    });

    it("should throw if decoded token has no sub", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id_token: "bad-token" }),
      });
      (jwt.decode as jest.Mock).mockReturnValue(null);

      await expect(
        exchangeCodeForProfile(
          SocialProvider.Apple,
          "auth-code",
          "http://localhost/callback",
          mockAppleConfig
        )
      ).rejects.toThrow("Invalid Apple ID token");
    });

    it("should return empty email if not provided by Apple", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id_token: "apple-token" }),
      });
      (jwt.decode as jest.Mock).mockReturnValue({
        sub: "apple-user-456",
      });

      const result = await exchangeCodeForProfile(
        SocialProvider.Apple,
        "auth-code",
        "http://localhost/callback",
        mockAppleConfig
      );

      expect(result.email).toBe("");
    });
  });

  describe("unsupported provider", () => {
    it("should throw for unknown provider", async () => {
      await expect(
        exchangeCodeForProfile(
          "twitter" as SocialProvider,
          "code",
          "http://localhost/callback",
          mockConfig
        )
      ).rejects.toThrow("Unsupported provider: twitter");
    });
  });
});
