import { createTtlCache } from "../ttlCache";

describe("createTtlCache", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should store and retrieve values", () => {
    const cache = createTtlCache<string>(60_000);
    cache.set("a", "one");
    expect(cache.get("a")).toBe("one");
  });

  it("should expire values after TTL", () => {
    const cache = createTtlCache<string>(1_000);
    cache.set("a", "one");
    jest.advanceTimersByTime(1_001);
    expect(cache.get("a")).toBeUndefined();
  });

  it("should evict oldest entry when at capacity", () => {
    const cache = createTtlCache<string>(60_000, 2);
    cache.set("a", "one");
    cache.set("b", "two");
    cache.set("c", "three");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("two");
    expect(cache.get("c")).toBe("three");
  });

  it("should clear all entries", () => {
    const cache = createTtlCache<string>(60_000);
    cache.set("a", "one");
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
  });
});
