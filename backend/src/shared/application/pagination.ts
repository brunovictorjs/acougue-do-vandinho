import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Rows per page on admin lists. */
export const ADMIN_PAGE_SIZE = 20;

/** `?page=` query param; extend it in list DTOs. */
export class PageQuery {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page?: number;
}

/** Prisma `skip`/`take` for a 1-based page. */
export function pageArgs(page = 1, pageSize = ADMIN_PAGE_SIZE) {
  const current = Math.max(1, Math.floor(page) || 1);
  return { page: current, pageSize, skip: (current - 1) * pageSize, take: pageSize };
}

/** Envelope every paginated admin list returns. */
export function paged<T>(items: T[], total: number, p: { page: number; pageSize: number }) {
  return { total, page: p.page, pageSize: p.pageSize, items };
}

/** Pages an in-memory list (for lists computed in code, not by the database). */
export function pageOf<T>(all: T[], page = 1, pageSize = ADMIN_PAGE_SIZE) {
  const p = pageArgs(page, pageSize);
  return paged(all.slice(p.skip, p.skip + p.take), all.length, p);
}
