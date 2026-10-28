import "server-only";
import type { SQL } from "drizzle-orm";
import { db } from "@/db";

/** Run a raw aggregate query and return typed rows (cast columns in SQL). */
export async function queryRows<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}

const iso = (d: Date | string | null) =>
  d === null ? null : new Date(d).toISOString();
export { iso };
