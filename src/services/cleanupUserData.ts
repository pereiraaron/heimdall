import {
  User,
  UserProjectMembership,
  RefreshToken,
  PasskeyCredential,
  SocialAccount,
} from "../models";

/**
 * If the user has no remaining memberships, deletes the user
 * and all associated records (tokens, passkeys, social accounts).
 */
export const cleanupOrphanedUser = async (userId: string) => {
  // exists() short-circuits on the first match; countDocuments scans them all.
  const hasRemaining = await UserProjectMembership.exists({ userId });
  if (hasRemaining) return;

  await Promise.all([
    RefreshToken.deleteMany({ userId }),
    PasskeyCredential.deleteMany({ userId }),
    SocialAccount.deleteMany({ userId }),
    User.findByIdAndDelete(userId),
  ]);
};
