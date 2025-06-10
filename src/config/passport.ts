import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as TwitterStrategy } from "passport-twitter";
import { User } from "../models/User";
import { AuthProvider, IUser } from "../types";
import { socialAuthConfig } from "../config/socialAuth";

// Serialize user to store in session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from stored session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err as Error, undefined);
  }
});

// Google Strategy
passport.use(
  new GoogleStrategy(
    socialAuthConfig.google,
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({
          provider: AuthProvider.Google,
          providerId: profile.id,
        });

        if (user) {
          return done(null, user);
        }

        // Check if the email exists but with a different provider
        user = await User.findOne({ email: profile.emails?.[0]?.value });

        if (user) {
          // Link existing account with Google
          user.provider = AuthProvider.Google;
          user.providerId = profile.id;
          user.profile = {
            displayName: profile.displayName,
            photos: profile.photos,
            emails: profile.emails,
          };
          await user.save();
          return done(null, user);
        }

        // Create a new user
        const newUser = await User.create({
          username:
            profile.displayName.replace(/\s/g, "") + profile.id.substring(0, 5),
          email: profile.emails?.[0]?.value,
          provider: AuthProvider.Google,
          providerId: profile.id,
          profile: {
            displayName: profile.displayName,
            photos: profile.photos,
            emails: profile.emails,
          },
        });

        return done(null, newUser);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

// Facebook Strategy
passport.use(
  new FacebookStrategy(
    socialAuthConfig.facebook,
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({
          provider: AuthProvider.Facebook,
          providerId: profile.id,
        });

        if (user) {
          return done(null, user);
        }

        // Check if the email exists but with a different provider
        if (profile.emails && profile.emails.length > 0) {
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            // Link existing account with Facebook
            user.provider = AuthProvider.Facebook;
            user.providerId = profile.id;
            user.profile = {
              displayName: profile.displayName,
              photos: profile.photos,
              emails: profile.emails,
            };
            await user.save();
            return done(null, user);
          }
        }

        // Create a new user
        const newUser = await User.create({
          username:
            profile.displayName.replace(/\s/g, "") + profile.id.substring(0, 5),
          email: profile.emails?.[0]?.value || `${profile.id}@facebook.com`,
          provider: AuthProvider.Facebook,
          providerId: profile.id,
          profile: {
            displayName: profile.displayName,
            photos: profile.photos,
            emails: profile.emails,
          },
        });

        return done(null, newUser);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

// Twitter Strategy
passport.use(
  new TwitterStrategy(
    socialAuthConfig.twitter,
    async (token, tokenSecret, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({
          provider: AuthProvider.Twitter,
          providerId: profile.id,
        });

        if (user) {
          return done(null, user);
        }

        // Check if the email exists but with a different provider
        if (profile.emails && profile.emails.length > 0) {
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            // Link existing account with Twitter
            user.provider = AuthProvider.Twitter;
            user.providerId = profile.id;
            user.profile = {
              displayName: profile.displayName,
              photos: profile.photos,
              emails: profile.emails,
            };
            await user.save();
            return done(null, user);
          }
        }

        // Create a new user
        const newUser = await User.create({
          username:
            profile.username ||
            profile.displayName.replace(/\s/g, "") + profile.id.substring(0, 5),
          email: profile.emails?.[0]?.value || `${profile.id}@twitter.com`,
          provider: AuthProvider.Twitter,
          providerId: profile.id,
          profile: {
            displayName: profile.displayName,
            photos: profile.photos,
            emails: profile.emails,
          },
        });

        return done(null, newUser);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

export default passport;
