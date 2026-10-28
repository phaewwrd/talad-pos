# Talad POS

Multi-tenant point of sale for small Thai restaurants and retail shops (TH/EN).
Next.js 16 (App Router, Cache Components) · Neon Postgres + Drizzle · Better Auth ·
next-intl · TanStack Query/Table/Form · shadcn/ui · Cloudinary. Full spec: `DOCs.MD`.

## Setup

```bash
pnpm install
cp .env.example .env        # fill DATABASE_URL, BETTER_AUTH_SECRET (openssl rand -base64 32), …
```

### Database

The original tables already existed before migrations were tracked, so
`drizzle/0000_baseline.sql` is a snapshot of them and `0001_pos_extensions.sql`
holds the additions (purely additive).

```bash
# Existing database (tables from 0000 already present):
pnpm db:baseline     # records 0000 as applied (no-op on a fresh DB)
pnpm db:migrate      # applies 0001+
# Fresh database: just `pnpm db:migrate`

pnpm db:seed         # demo data — prints logins, staff PINs and an invite link
```

Seeded accounts: platform admin `admin@talad.local / Admin1234!`, demo owner
`owner@talad.local / Owner1234!`, staff PINs `1234` (manager) and `5678` (cashier).
Before staff can use their PIN, the owner opens `/th/pin` on that device and
chooses **Use this device for POS**.

### Run

```bash
pnpm dev             # http://localhost:3000 → /th/pos
pnpm lint | pnpm typecheck | pnpm test | pnpm build
```

`pnpm test` runs the pricing / promotion / VAT / FIFO / range unit tests. The
cross-tenant isolation test (`tests/integration/tenancy.test.ts`) also runs
when `TEST_DATABASE_URL` points at a migrated throwaway database (e.g. a Neon branch).

## Architecture

```
app/[locale]/(auth)      login, signup?token=, pin, forgot/reset password
app/[locale]/(app)       POS, orders, products, stock, promotions, sales, cost-profit, settings
app/[locale]/(print)     printable receipts (58/80mm)
app/[locale]/admin       platform admin (invites, shops)
app/api/**               JSON route handlers (reads) + Better Auth + Cloudinary signing
features/<domain>/       schemas.ts (Zod) · actions.ts (Server Actions) · queries.ts · components/
lib/pricing, lib/promotions, lib/stock/fifo.ts   pure engines (tested)
lib/stock/db.ts          FIFO lot locking / allocation / return in transactions
lib/permissions.ts       requireMember({ roles, feature }) — org from the session, never the client
proxy.ts                 next-intl routing + optimistic auth redirect
```

Money is `decimal.js` in memory and `numeric(12,2)` strings in the DB. All
displayed times and day boundaries are Asia/Bangkok.

Open product decisions are marked `TODO(decision)` in the code.
