import { grantAllProjectsAccess } from "../grantAllProjectsAccess";
import { Project, UserProjectMembership } from "../../models";
import { MembershipRole, MembershipStatus } from "../../types";

jest.mock("../../models", () => ({
  Project: {
    find: jest.fn(),
  },
  UserProjectMembership: {
    bulkWrite: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockFindLean = (mock: jest.Mock, value: unknown) => {
  mock.mockReturnValue({ lean: jest.fn().mockResolvedValue(value) });
};

const bulkWriteOps = () => (UserProjectMembership.bulkWrite as jest.Mock).mock.calls[0][0];

describe("grantAllProjectsAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should upsert a membership for every project", async () => {
    mockFindLean(Project.find as jest.Mock, [{ _id: "p1" }, { _id: "p2" }, { _id: "p3" }]);

    await grantAllProjectsAccess("user-123");

    expect(UserProjectMembership.bulkWrite).toHaveBeenCalledTimes(1);
    expect(bulkWriteOps()).toHaveLength(3);
  });

  it("should scope each upsert to the user and project", async () => {
    mockFindLean(Project.find as jest.Mock, [{ _id: "p1" }]);

    await grantAllProjectsAccess("user-123");

    expect(bulkWriteOps()[0]).toEqual(
      expect.objectContaining({
        updateOne: expect.objectContaining({
          filter: { userId: "user-123", projectId: "p1" },
          upsert: true,
        }),
      })
    );
  });

  it("should only set fields on insert so existing memberships are untouched", async () => {
    mockFindLean(Project.find as jest.Mock, [{ _id: "p1" }]);

    await grantAllProjectsAccess("user-123");

    const { update } = bulkWriteOps()[0].updateOne;
    expect(update.$set).toBeUndefined();
    expect(update.$setOnInsert).toEqual(
      expect.objectContaining({
        role: MembershipRole.Member,
        status: MembershipStatus.Active,
      })
    );
  });

  it("should run unordered so one duplicate doesn't abort the batch", async () => {
    mockFindLean(Project.find as jest.Mock, [{ _id: "p1" }]);

    await grantAllProjectsAccess("user-123");

    expect((UserProjectMembership.bulkWrite as jest.Mock).mock.calls[0][1]).toEqual(
      expect.objectContaining({ ordered: false })
    );
  });

  it("should handle empty project list without writing", async () => {
    mockFindLean(Project.find as jest.Mock, []);

    await grantAllProjectsAccess("user-123");

    expect(UserProjectMembership.bulkWrite).not.toHaveBeenCalled();
  });
});
