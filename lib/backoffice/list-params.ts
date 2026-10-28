import * as z from "zod";
import { AppError } from "@/lib/errors";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Common list query params: paging, sort, Bangkok date range, search. */
export const listParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [20, 50, 100].includes(n))
    .default(20),
  sort: z.string().max(40).optional(),
  dir: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().trim().max(100).optional(),
  from: z.string().regex(DATE).optional(),
  to: z.string().regex(DATE).optional(),
});

export function parseQuery<S extends z.ZodType>(request: Request, schema: S) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const r = schema.safeParse(params);
  if (!r.success) throw new AppError("VALIDATION");
  return r.data as z.output<S>;
}

/** `YYYY-MM-DD` (Bangkok) → [start, end) instants. Bangkok is UTC+7, no DST. */
export function bangkokRange(from?: string, to?: string) {
  return {
    start: from ? new Date(`${from}T00:00:00+07:00`) : undefined,
    end: to
      ? new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86_400_000)
      : undefined,
  };
}

/** Escape LIKE wildcards in user search input. */
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function pageOffset(p: { page: number; pageSize: number }) {
  return (p.page - 1) * p.pageSize;
}
