// One-off helper for databases created before Drizzle migrations were tracked:
// the 0000_baseline tables already exist, so record 0000 as applied and let
// `drizzle-kit migrate` run only the later migrations.
//   pnpm db:baseline && pnpm db:migrate
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const sql = neon(url);

  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  );
  const baseline = journal.entries[0];
  const file = readFileSync(`drizzle/${baseline.tag}.sql`, "utf8");
  const hash = createHash("sha256").update(file).digest("hex");

  const [{ exists }] =
    await sql`select to_regclass('public.products') is not null as exists`;
  if (!exists) {
    console.log("Fresh database — nothing to mark. Run `pnpm db:migrate`.");
    return;
  }

  await sql`create schema if not exists drizzle`;
  await sql`create table if not exists drizzle.__drizzle_migrations (
    id serial primary key, hash text not null, created_at bigint)`;
  const rows =
    await sql`select 1 from drizzle.__drizzle_migrations where hash = ${hash}`;
  if (rows.length) {
    console.log(`${baseline.tag} already marked as applied.`);
    return;
  }
  await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${baseline.when})`;
  console.log(`Marked ${baseline.tag} as applied.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
