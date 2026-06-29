import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../config/constants.js';

export function pagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page ?? DEFAULT_PAGE), 1);
  const limit = Math.min(Math.max(Number(query.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  const skip = (page - 1) * limit;
  return { page, limit, skip, take: limit };
}

export function meta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
