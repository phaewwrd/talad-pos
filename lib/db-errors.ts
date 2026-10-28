/** Postgres unique_violation (23505), optionally for a specific constraint. */
export function isUniqueViolation(err: unknown, constraint?: string) {
  const e = (err as { cause?: unknown })?.cause ?? err;
  const pg = e as { code?: string; constraint?: string };
  return pg?.code === "23505" && (!constraint || pg.constraint === constraint);
}

/** Postgres foreign_key_violation (23503). */
export function isForeignKeyViolation(err: unknown) {
  const e = (err as { cause?: unknown })?.cause ?? err;
  return (e as { code?: string })?.code === "23503";
}
