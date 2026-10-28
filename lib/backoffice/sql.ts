import "server-only";
import type { SQL } from "drizzle-orm";
import { db } from "@/db";
import { pgTimestampToIso } from "./pg-time";

/**
 * Run a raw aggregate query and return typed rows (cast columns in SQL).
 * Note: drizzle returns timestamps from raw queries as Postgres text; convert
 * them with `iso()`. Better Auth tables use `timestamp` without time zone
 * (UTC) — select those as `col AT TIME ZONE 'UTC'` first.
 */
export async function queryRows<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}

export const iso = pgTimestampToIso;
