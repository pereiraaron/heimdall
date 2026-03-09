import { grantAllProjectsAccess } from "../grantAllProjectsAccess";
import { Project, UserProjectMembership } from "../../models";
import { MembershipRole, MembershipStatus } from "../../types";

jest.mock("../../models", () => ({
  Project: {
    find: jest.fn(),
  },
  UserProjectMembership: {
    find: jest.fn(),
    insertMany: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockFindLean = (mock: jest.Mock, value: unknown) => {
  mock.mockReturnValue({ lean: jest.fn().mockResolvedValue(value) });
};

describe("grantAllProjectsAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create memberships for projects the user is not in", async () => {
    mockFindLean(Project.find as jest.Mock, [
      { _id: { toString: () => "p1" } },
      { _id: { toString: () => "p2" } },
      { _id: { toString: () => "p3" } },
    ]);
    mockFindLean(UserProjectMembership.find as jest.Mock, [
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
    mockFindLean(Project.find as jest.Mock, [{ _id: { toString: () => "p1" } }]);
    mockFindLean(UserProjectMembership.find as jest.Mock, [
      { projectId: { toString: () => "p1" } },
    ]);

    await grantAllProjectsAccess("user-123");

    expect(UserProjectMembership.insertMany).not.toHaveBeenCalled();
  });

  it("should handle empty project list", async () => {
    mockFindLean(Project.find as jest.Mock, []);
    mockFindLean(UserProjectMembership.find as jest.Mock, []);

    await grantAllProjectsAccess("user-123");

    expect(UserProjectMembership.insertMany).not.toHaveBeenCalled();
  });

  it("should create memberships for all projects if user has none", async () => {
    mockFindLean(Project.find as jest.Mock, [
      { _id: { toString: () => "p1" } },
      { _id: { toString: () => "p2" } },
    ]);
    mockFindLean(UserProjectMembership.find as jest.Mock, []);

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
