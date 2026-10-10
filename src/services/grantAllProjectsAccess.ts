import { Project, UserProjectMembership } from "../models";
import { Types } from "mongoose";
import { MembershipRole, MembershipStatus } from "../types";
import { createTtlCache } from "../utils/ttlCache";

const PROJECT_IDS_TTL_MS = 60 * 1000;
const PROJECT_IDS_KEY = "all";

// Registration would otherwise scan the whole projects collection every time.
// A new project is picked up within the TTL.
const projectIdsCache = createTtlCache<Types.ObjectId[]>(PROJECT_IDS_TTL_MS, 1);

/** Clears the cached project id list � useful in tests. */
export const clearProjectIdsCache = () => {
  projectIdsCache.clear();
};

/**
 * Creates an active membership for the given user in every project
 * that they don't already belong to.
 */
export const grantAllProjectsAccess = async (userId: string) => {
  let projectIds = projectIdsCache.get(PROJECT_IDS_KEY);
  if (!projectIds) {
    const allProjects = await Project.find({}, "_id").lean();
    projectIds = allProjects.map((project) => project._id);
    projectIdsCache.set(PROJECT_IDS_KEY, projectIds);
  }
  if (projectIds.length === 0) return;

  const now = new Date();

  // Upserts against the unique {userId, projectId} index: one round trip, and
  // no read of existing memberships. $setOnInsert leaves existing rows untouched.
  await UserProjectMembership.bulkWrite(
    projectIds.map((projectId) => ({
      updateOne: {
        filter: { userId, projectId },
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
