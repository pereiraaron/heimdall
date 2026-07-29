import { Request } from "express";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export type Pagination = {
  page: number;
  limit: number;
  skip: number;
};

/**
 * Parses `?page` and `?limit` into safe bounds so list endpoints can never
 * be asked to load an entire collection into memory.
 */
export const parsePagination = (query?: Request["query"]): Pagination => {
  const rawLimit = Number(query?.limit);
  const rawPage = Number(query?.page);

  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  const page = Number.isFinite(rawPage) && rawPage > 1 ? Math.floor(rawPage) : 1;

  return { page, limit, skip: (page - 1) * limit };
};
