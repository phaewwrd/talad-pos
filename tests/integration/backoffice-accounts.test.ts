// Backoffice account scripts against a real Postgres (TEST_DATABASE_URL, a
// migrated throwaway Neon branch):
//   TEST_DATABASE_URL=postgres://… pnpm test
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret";

const ctx = { osUser: "tester", script: "backoffice:test" };

describe.skipIf(!url)("backoffice account scripts (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const email = `bo-${run}@test.invalid`;
  const shopEmail = `shop-${run}@test.invalid`;
  const ids = { org: randomUUID(), shopUser: randomUUID() };

  beforeAll(async () => {
    const { db } = await import("@/db");
    const s = await import("@/db/schema");
    await db
      .insert(s.user)
      .values({ id: ids.shopUser, name: "Owner", email: shopEmail });
    await db
      .insert(s.organization)
      .values({ id: ids.org, name: "Shop", slug: `s-${ids.org}` });
    await db
      .insert(s.member)
      .values({ organizationId: ids.org, userId: ids.shopUser, role: "owner" });
  });

  afterAll(async () => {
    const { db } = await import("@/db");
    const s = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");
    await db
      .delete(s.organization)
      .where(inArray(s.organization.id, [ids.org]));
    await db.delete(s.user).where(inArray(s.user.email, [email, shopEmail]));
  });

  async function auditRows(targetId: string) {
    const { db } = await import("@/db");
    const s = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    return db
      .select()
      .from(s.platformAuditLogs)
      .where(eq(s.platformAuditLogs.targetId, targetId));
  }

  it("creates a user with a generated password that must be changed", async () => {
    const { createBackofficeUser } = await import("@/lib/backoffice/accounts");
    const r = await createBackofficeUser(
      { email, name: "Dev", role: "support" },
      ctx,
    );
    expect(r.created).toBe(true);
    expect(r.generatedPassword?.length).toBeGreaterThanOrEqual(20);

    const { db } = await import("@/db");
    const s = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [u] = await db.select().from(s.user).where(eq(s.user.id, r.userId));
    expect(u.role).toBe("support");
    expect(u.mustChangePassword).toBe(true);

    const [acct] = await db
      .select()
      .from(s.account)
      .where(eq(s.account.userId, r.userId));
    expect(acct.providerId).toBe("credential");
    expect(acct.password).not.toContain(r.generatedPassword);

    const rows = await auditRows(r.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: null,
      actorLabel: "system:script",
      action: "backoffice_user.create",
    });
    expect(rows[0].userAgent).toContain("tester");
  });

  it("is idempotent: create-user again updates name and role", async () => {
    const { createBackofficeUser } = await import("@/lib/backoffice/accounts");
    const r = await createBackofficeUser(
      { email, name: "Dev 2", role: "super_admin" },
      ctx,
    );
    expect(r.created).toBe(false);
    expect(r.generatedPassword).toBeNull();
    const rows = await auditRows(r.userId);
    expect(rows.map((x) => x.action).sort()).toEqual([
      "backoffice_user.create",
      "backoffice_user.update",
    ]);
  });

  it("refuses to touch shop accounts", async () => {
    const a = await import("@/lib/backoffice/accounts");
    await expect(
      a.createBackofficeUser(
        { email: shopEmail, name: "x", role: "super_admin" },
        ctx,
      ),
    ).rejects.toBeInstanceOf(a.AccountScriptError);
    await expect(
      a.setBackofficeRole({ email: shopEmail, role: "super_admin" }, ctx),
    ).rejects.toBeInstanceOf(a.AccountScriptError);
    expect(await auditRows(ids.shopUser)).toHaveLength(0);
  });

  it("deactivate bans and revokes sessions; reactivate restores", async () => {
    const a = await import("@/lib/backoffice/accounts");
    const { db } = await import("@/db");
    const s = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [u] = await db.select().from(s.user).where(eq(s.user.email, email));
    await db.insert(s.session).values({
      userId: u.id,
      token: `t-${run}`,
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    await a.deactivateBackofficeUser({ email }, ctx);
    const [banned] = await db.select().from(s.user).where(eq(s.user.id, u.id));
    expect(banned.banned).toBe(true);
    expect(
      await db.select().from(s.session).where(eq(s.session.userId, u.id)),
    ).toHaveLength(0);

    await a.reactivateBackofficeUser({ email }, ctx);
    const [back] = await db.select().from(s.user).where(eq(s.user.id, u.id));
    expect(back.banned).toBe(false);
  });

  it("the audit log is append-only", async () => {
    const { db } = await import("@/db");
    const s = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [u] = await db.select().from(s.user).where(eq(s.user.email, email));
    await expect(
      db
        .update(s.platformAuditLogs)
        .set({ reason: "tampered" })
        .where(eq(s.platformAuditLogs.targetId, u.id)),
    ).rejects.toThrow();
    await expect(
      db
        .delete(s.platformAuditLogs)
        .where(eq(s.platformAuditLogs.targetId, u.id)),
    ).rejects.toThrow();
  });
});
