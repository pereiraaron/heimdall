import jwt from "jsonwebtoken";
import { SocialProvider, SocialProfile, ISocialProviderConfig, IAppleProviderConfig } from "@types";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";

const googleExchange = async (
  code: string,
  redirectUri: string,
  config: ISocialProviderConfig
): Promise<SocialProfile> => {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Google authorization code");
  }

  const data = await response.json();
  const idToken = data.id_token;

  if (!idToken) {
    throw new Error("No ID token returned from Google");
  }

  // Decode the ID token (Google's token endpoint returns a valid token signed by Google)
  const decoded = jwt.decode(idToken) as {
    sub: string;
    email: string;
    name?: string;
  } | null;

  if (!decoded?.sub || !decoded?.email) {
    throw new Error("Invalid Google ID token");
  }

  return {
    providerUserId: decoded.sub,
    email: decoded.email,
    displayName: decoded.name,
  };
};

const githubExchange = async (
  code: string,
  _redirectUri: string,
  config: ISocialProviderConfig
): Promise<SocialProfile> => {
  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange GitHub authorization code");
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    throw new Error("No access token returned from GitHub");
  }

  // Fetch user profile
  const userResponse = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!userResponse.ok) {
    throw new Error("Failed to fetch GitHub user profile");
  }

  const userData = await userResponse.json();

  // If email is private, fetch from emails endpoint
  let email = userData.email;
  if (!email) {
    const emailsResponse = await fetch(GITHUB_EMAILS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (emailsResponse.ok) {
      const emails = await emailsResponse.json();
      const primary = emails.find(
        (e: { primary: boolean; verified: boolean; email: string }) => e.primary && e.verified
      );
      email = primary?.email;
    }
  }

  if (!email) {
    throw new Error("Could not retrieve email from GitHub. Ensure email scope is granted.");
  }

  return {
    providerUserId: String(userData.id),
    email,
    displayName: userData.name || userData.login,
  };
};

const generateAppleClientSecret = (config: IAppleProviderConfig): string => {
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iss: config.teamId,
      iat: now,
      exp: now + 15777000, // ~6 months
      aud: "https://appleid.apple.com",
      sub: config.clientId,
    },
    config.privateKey,
    {
      algorithm: "ES256",
      keyid: config.keyId,
    }
  );
};

const appleExchange = async (
  code: string,
  redirectUri: string,
  config: IAppleProviderConfig
): Promise<SocialProfile> => {
  const clientSecret = generateAppleClientSecret(config);

  const response = await fetch(APPLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Apple authorization code");
  }

  const data = await response.json();
  const idToken = data.id_token;

  if (!idToken) {
    throw new Error("No ID token returned from Apple");
  }

  const decoded = jwt.decode(idToken) as {
    sub: string;
    email?: string;
  } | null;

  if (!decoded?.sub) {
    throw new Error("Invalid Apple ID token");
  }

  return {
    providerUserId: decoded.sub,
    email: decoded.email || "",
    displayName: undefined,
  };
};

export const exchangeCodeForProfile = async (
  provider: SocialProvider,
  code: string,
  redirectUri: string,
  config: ISocialProviderConfig
): Promise<SocialProfile> => {
  switch (provider) {
    case SocialProvider.Google:
      return googleExchange(code, redirectUri, config);
    case SocialProvider.GitHub:
      return githubExchange(code, redirectUri, config);
    case SocialProvider.Apple:
      return appleExchange(code, redirectUri, config as IAppleProviderConfig);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};
