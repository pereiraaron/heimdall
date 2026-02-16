import { Project, UserProjectMembership } from "@models";
import { MembershipRole, MembershipStatus } from "@types";

/**
 * Creates an active membership for the given user in every project
 * that they don't already belong to.
 */
export const grantAllProjectsAccess = async (userId: string) => {
  const allProjects = await Project.find({}, "_id");

  const existingMemberships = await UserProjectMembership.find({ userId }, "projectId");
  const existingProjectIds = new Set(existingMemberships.map((m) => m.projectId.toString()));

  const newMemberships = allProjects
    .filter((p) => !existingProjectIds.has(p._id.toString()))
    .map((p) => ({
      userId,
      projectId: p._id,
      role: MembershipRole.Member,
      status: MembershipStatus.Active,
      joinedAt: new Date(),
    }));

  if (newMemberships.length > 0) {
    await UserProjectMembership.insertMany(newMemberships);
  }
};
