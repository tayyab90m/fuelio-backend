import { z } from "zod";

// Standard page/limit query-param pagination shared by every list endpoint.
// `page` defaults to 1, `limit` defaults to 20 and is capped at 100 to keep
// a single request from pulling an unbounded number of rows.
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function buildPaginationMeta(query: PaginationQuery, total: number): PaginationMeta {
  return {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export function paginationArgs(query: PaginationQuery) {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}
