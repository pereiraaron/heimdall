import { grantAllProjectsAccess } from "../grantAllProjectsAccess";
import { Project, UserProjectMembership } from "@models";
import { MembershipRole, MembershipStatus } from "@types";

jest.mock("@models", () => ({
  Project: {
    find: jest.fn(),
  },
  UserProjectMembership: {
    find: jest.fn(),
    insertMany: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("grantAllProjectsAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create memberships for projects the user is not in", async () => {
    (Project.find as jest.Mock).mockResolvedValue([
      { _id: { toString: () => "p1" } },
      { _id: { toString: () => "p2" } },
      { _id: { toString: () => "p3" } },
    ]);
    (UserProjectMembership.find as jest.Mock).mockResolvedValue([
      { projectId: { toString: () => "p1" } },
    ]);

    await grantAllProjectsAccess("user-123");

    expect(UserProjectMembership.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user-123",
          role: MembershipRole.Member,
          status: MembershipStatus.Active,
        }),
      ])
    );
    const insertedMemberships = (UserProjectMembership.insertMany as jest.Mock).mock.calls[0][0];
    expect(insertedMemberships).toHaveLength(2);
  });

  it("should not call insertMany if user is already in all projects", async () => {
    (Project.find as jest.Mock).mockResolvedValue([
      { _id: { toString: () => "p1" } },
    ]);
    (UserProjectMembership.find as jest.Mock).mockResolvedValue([
      { projectId: { toString: () => "p1" } },
    ]);

    await grantAllProjectsAccess("user-123");

    expect(UserProjectMembership.insertMany).not.toHaveBeenCalled();
  });

  it("should handle empty project list", async () => {
    (Project.find as jest.Mock).mockResolvedValue([]);
    (UserProjectMembership.find as jest.Mock).mockResolvedValue([]);

    await grantAllProjectsAccess("user-123");

    expect(UserProjectMembership.insertMany).not.toHaveBeenCalled();
  });

  it("should create memberships for all projects if user has none", async () => {
    (Project.find as jest.Mock).mockResolvedValue([
      { _id: { toString: () => "p1" } },
      { _id: { toString: () => "p2" } },
    ]);
    (UserProjectMembership.find as jest.Mock).mockResolvedValue([]);

    await grantAllProjectsAccess("user-123");

    const insertedMemberships = (UserProjectMembership.insertMany as jest.Mock).mock.calls[0][0];
    expect(insertedMemberships).toHaveLength(2);
    expect(insertedMemberships[0]).toEqual(
      expect.objectContaining({
        userId: "user-123",
        role: MembershipRole.Member,
        status: MembershipStatus.Active,
      })
    );
  });
});
