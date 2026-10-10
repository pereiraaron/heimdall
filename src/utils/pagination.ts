import { Request } from "express";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export type Pagination = {
  page: number;
  limit: number;
  skip: number;
  /** Membership `_id` to continue after. When set, `skip` is 0 so deep pages stay fast. */
  after?: string;
  /** False when the caller passed `?count=false` to skip the total-count query. */
  includeCount: boolean;
};

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

/**
 * Parses `?page`, `?limit`, `?after` and `?count` into safe bounds so list
 * endpoints can never be asked to load an entire collection into memory.
 * `?after=<id>` is a cursor that avoids the cost of `skip` on deep pages.
 */
export const parsePagination = (query?: Request["query"]): Pagination => {
  const rawLimit = Number(query?.limit);
  const rawPage = Number(query?.page);

  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  const page = Number.isFinite(rawPage) && rawPage > 1 ? Math.floor(rawPage) : 1;

  const rawAfter = query?.after;
  const after =
    typeof rawAfter === "string" && OBJECT_ID_PATTERN.test(rawAfter) ? rawAfter : undefined;

  return {
    page,
    limit,
    skip: after ? 0 : (page - 1) * limit,
    after,
    includeCount: query?.count !== "false",
  };
};
