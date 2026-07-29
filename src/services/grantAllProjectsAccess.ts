import { Project, UserProjectMembership } from "../models";
import { MembershipRole, MembershipStatus } from "../types";

/**
 * Creates an active membership for the given user in every project
 * that they don't already belong to.
 */
export const grantAllProjectsAccess = async (userId: string) => {
  const allProjects = await Project.find({}, "_id").lean();
  if (allProjects.length === 0) return;

  const now = new Date();

  // Upserts against the unique {userId, projectId} index: one round trip, and
  // no read of existing memberships. $setOnInsert leaves existing rows untouched.
  await UserProjectMembership.bulkWrite(
    allProjects.map((project) => ({
      updateOne: {
        filter: { userId, projectId: project._id },
        update: {
          $setOnInsert: {
            role: MembershipRole.Member,
            status: MembershipStatus.Active,
            joinedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    })),
    // Timestamps are set explicitly above so existing rows don't get bumped.
    { ordered: false, timestamps: false }
  );
};
