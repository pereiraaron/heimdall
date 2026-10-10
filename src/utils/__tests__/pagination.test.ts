import { parsePagination } from "../pagination";

describe("parsePagination", () => {
  it("should return defaults when no query is given", () => {
    expect(parsePagination()).toEqual({
      page: 1,
      limit: 50,
      skip: 0,
      after: undefined,
      includeCount: true,
    });
  });

  it("should compute skip from page and limit", () => {
    expect(parsePagination({ page: "3", limit: "10" })).toEqual(
      expect.objectContaining({ page: 3, limit: 10, skip: 20 })
    );
  });

  it("should accept a valid cursor and ignore skip", () => {
    const result = parsePagination({ after: "507f1f77bcf86cd799439011", page: "4" });
    expect(result.after).toBe("507f1f77bcf86cd799439011");
    expect(result.skip).toBe(0);
  });

  it("should ignore a malformed cursor", () => {
    const result = parsePagination({ after: "not-an-id", page: "2", limit: "10" });
    expect(result.after).toBeUndefined();
    expect(result.skip).toBe(10);
  });

  it("should only disable counting for count=false", () => {
    expect(parsePagination({ count: "false" }).includeCount).toBe(false);
    expect(parsePagination({ count: "true" }).includeCount).toBe(true);
  });
});
