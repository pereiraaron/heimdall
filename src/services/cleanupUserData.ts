import {
  User,
  UserProjectMembership,
  RefreshToken,
  PasskeyCredential,
  SocialAccount,
} from "@models";

/**
 * If the user has no remaining memberships, deletes the user
 * and all associated records (tokens, passkeys, social accounts).
 */
export const cleanupOrphanedUser = async (userId: string) => {
  const remaining = await UserProjectMembership.countDocuments({ userId });
  if (remaining > 0) return;

  await Promise.all([
    RefreshToken.deleteMany({ userId }),
    PasskeyCredential.deleteMany({ userId }),
    SocialAccount.deleteMany({ userId }),
    User.findByIdAndDelete(userId),
  ]);
};
