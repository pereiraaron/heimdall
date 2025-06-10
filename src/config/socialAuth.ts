// Social authentication configuration
export const socialAuthConfig = {
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    callbackURL:
      process.env.GOOGLE_CALLBACK_URL ||
      "http://localhost:7001/api/auth/google/callback",
  },
  facebook: {
    clientID: process.env.FACEBOOK_APP_ID || "",
    clientSecret: process.env.FACEBOOK_APP_SECRET || "",
    callbackURL:
      process.env.FACEBOOK_CALLBACK_URL ||
      "http://localhost:7001/api/auth/facebook/callback",
    profileFields: ["id", "displayName", "photos", "email"],
  },
  twitter: {
    consumerKey: process.env.TWITTER_CONSUMER_KEY || "",
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET || "",
    callbackURL:
      process.env.TWITTER_CALLBACK_URL ||
      "http://localhost:7001/api/auth/twitter/callback",
    includeEmail: true,
  },
};
