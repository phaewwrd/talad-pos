import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, max, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  account,
  backofficeLoginAttempts,
  member,
  session,
  twoFactor,
  user,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { SCRIPT_ACTOR_LABEL, writeAudit } from "@/lib/backoffice/audit";
import {
  BACKOFFICE_ROLES,
  type BackofficeRole,
  isBackofficeRole,
} from "@/lib/backoffice/roles";

// Backoffice account management. Used only by scripts/backoffice/* and the dev
// seed — there is deliberately no HTTP route or Server Action for any of it.
//
// Password hashing goes through Better Auth (auth.api.createUser /
// ctx.password.hash) so logins behave exactly like normal ones. The admin
// endpoints that need an HTTP admin session (setRole, banUser,
// revokeUserSessions) can't be called from a script, so the equivalent column
// updates and session deletions run here in one transaction with the audit row.

export class AccountScriptError extends Error {}

export type ScriptContext = { osUser: string; script: string };

const scriptActor = { id: null, label: SCRIPT_ACTOR_LABEL } as const;

function scriptMeta(ctx: ScriptContext) {
  return { ip: null, userAgent: `${ctx.script} (os user: ${ctx.osUser})` };
}

/** ≥ 20 characters of base64url (144 bits). */
export function generatePassword() {
  return randomBytes(18).toString("base64url");
}

async function findUserByEmail(email: string) {
  const [row] = await db
    .select()
    .from(user)
    .where(sql`lower(${user.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return row ?? null;
}

/** Shop accounts and backoffice accounts never mix. */
async function assertNotShopUser(userId: string) {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1);
  if (row) {
    throw new AccountScriptError(
      "This user belongs to a shop organization; refusing to modify it.",
    );
  }
}

async function requireBackofficeUser(email: string) {
  const row = await findUserByEmail(email);
  if (!row) throw new AccountScriptError(`No user with email ${email}.`);
  await assertNotShopUser(row.id);
  if (!isBackofficeRole(row.role)) {
    throw new AccountScriptError(
      `${email} is not a backoffice user (role: ${row.role ?? "none"}).`,
    );
  }
  return row;
}

function publicFields(u: {
  email: string;
  name: string;
  role: string | null;
  banned: boolean | null;
  twoFactorEnabled: boolean | null;
  mustChangePassword: boolean;
}) {
  return {
    email: u.email,
    name: u.name,
    role: u.role,
    banned: !!u.banned,
    twoFactorEnabled: !!u.twoFactorEnabled,
    mustChangePassword: u.mustChangePassword,
  };
}

async function setCredentialPassword(tx: Tx, userId: string, password: string) {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  const updated = await tx
    .update(account)
    .set({ password: hash, updatedAt: new Date() })
    .where(
      and(eq(account.userId, userId), eq(account.providerId, "credential")),
    )
    .returning({ id: account.id });
  if (updated.length === 0) {
    await tx.insert(account).values({
      userId,
      accountId: userId,
      providerId: "credential",
      password: hash,
    });
  }
}

/**
 * Create a backoffice user, or update name/role (and password, if given) of an
 * existing one. Returns the generated password when none was supplied.
 */
export async function createBackofficeUser(
  input: {
    email: string;
    name: string;
    role: BackofficeRole;
    password?: string;
  },
  ctx: ScriptContext,
): Promise<{
  userId: string;
  created: boolean;
  generatedPassword: string | null;
}> {
  const email = input.email.toLowerCase();
  const existing = await findUserByEmail(email);

  if (existing) {
    await assertNotShopUser(existing.id);
    if (
      existing.role &&
      existing.role !== "user" &&
      !isBackofficeRole(existing.role)
    ) {
      throw new AccountScriptError(`Unexpected role "${existing.role}".`);
    }
    await db.transaction(async (tx) => {
      const [after] = await tx
        .update(user)
        .set({
          name: input.name,
          role: input.role,
          ...(input.password ? { mustChangePassword: false } : {}),
          updatedAt: new Date(),
        })
        .where(eq(user.id, existing.id))
        .returning();
      if (input.password) {
        await setCredentialPassword(tx, existing.id, input.password);
      }
      await writeAudit(tx, {
        actor: scriptActor,
        action: "backoffice_user.update",
        targetType: "backoffice_user",
        targetId: existing.id,
        before: publicFields(existing),
        after: { ...publicFields(after), passwordChanged: !!input.password },
        ...scriptMeta(ctx),
      });
    });
    return { userId: existing.id, created: false, generatedPassword: null };
  }

  const generatedPassword = input.password ? null : generatePassword();
  const { user: created } = await auth.api.createUser({
    body: {
      email,
      name: input.name,
      role: input.role,
      password: input.password ?? (generatedPassword as string),
    },
  });
  await db.transaction(async (tx) => {
    const [after] = await tx
      .update(user)
      .set({
        mustChangePassword: generatedPassword !== null,
        emailVerified: true,
      })
      .where(eq(user.id, created.id))
      .returning();
    await writeAudit(tx, {
      actor: scriptActor,
      action: "backoffice_user.create",
      targetType: "backoffice_user",
      targetId: created.id,
      after: publicFields(after),
      ...scriptMeta(ctx),
    });
  });
  return { userId: created.id, created: true, generatedPassword };
}

export async function setBackofficeRole(
  input: { email: string; role: BackofficeRole },
  ctx: ScriptContext,
) {
  const before = await requireBackofficeUser(input.email);
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ role: input.role, updatedAt: new Date() })
      .where(eq(user.id, before.id));
    // A role change takes effect on the next login.
    await tx.delete(session).where(eq(session.userId, before.id));
    await writeAudit(tx, {
      actor: scriptActor,
      action: "backoffice_user.role_change",
      targetType: "backoffice_user",
      targetId: before.id,
      before: { role: before.role },
      after: { role: input.role },
      ...scriptMeta(ctx),
    });
  });
}

/** Ban the user and revoke all of their sessions. */
export async function deactivateBackofficeUser(
  input: { email: string; reason?: string },
  ctx: ScriptContext,
) {
  const before = await requireBackofficeUser(input.email);
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        banned: true,
        banReason: input.reason ?? "Deactivated by script",
        banExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, before.id));
    await tx.delete(session).where(eq(session.userId, before.id));
    await writeAudit(tx, {
      actor: scriptActor,
      action: "backoffice_user.deactivate",
      targetType: "backoffice_user",
      targetId: before.id,
      reason: input.reason,
      before: { banned: !!before.banned },
      after: { banned: true },
      ...scriptMeta(ctx),
    });
  });
}

export async function reactivateBackofficeUser(
  input: { email: string },
  ctx: ScriptContext,
) {
  const before = await requireBackofficeUser(input.email);
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        banned: false,
        banReason: null,
        banExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, before.id));
    await writeAudit(tx, {
      actor: scriptActor,
      action: "backoffice_user.reactivate",
      targetType: "backoffice_user",
      targetId: before.id,
      before: { banned: !!before.banned },
      after: { banned: false },
      ...scriptMeta(ctx),
    });
  });
}

/** Remove TOTP + backup codes and sign out; the next login re-enrolls. */
export async function resetBackofficeTwoFactor(
  input: { email: string },
  ctx: ScriptContext,
) {
  const before = await requireBackofficeUser(input.email);
  await db.transaction(async (tx) => {
    await tx.delete(twoFactor).where(eq(twoFactor.userId, before.id));
    await tx
      .update(user)
      .set({ twoFactorEnabled: false, updatedAt: new Date() })
      .where(eq(user.id, before.id));
    await tx.delete(session).where(eq(session.userId, before.id));
    await writeAudit(tx, {
      actor: scriptActor,
      action: "backoffice_user.reset_2fa",
      targetType: "backoffice_user",
      targetId: before.id,
      before: { twoFactorEnabled: !!before.twoFactorEnabled },
      after: { twoFactorEnabled: false },
      ...scriptMeta(ctx),
    });
  });
}

/** Backoffice users with 2FA / ban state and last login. Never secrets. */
export async function listBackofficeUsers() {
  // Sessions are deleted on logout, so last login comes from the login log.
  const lastLogin = db
    .select({
      email: backofficeLoginAttempts.email,
      at: max(backofficeLoginAttempts.createdAt).as("at"),
    })
    .from(backofficeLoginAttempts)
    .where(eq(backofficeLoginAttempts.success, true))
    .groupBy(backofficeLoginAttempts.email)
    .as("last_login");
  return db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      banned: user.banned,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: lastLogin.at,
      createdAt: user.createdAt,
    })
    .from(user)
    .leftJoin(lastLogin, eq(lastLogin.email, sql`lower(${user.email})`))
    .where(inArray(user.role, [...BACKOFFICE_ROLES]))
    .orderBy(desc(user.createdAt));
}
