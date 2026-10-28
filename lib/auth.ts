import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, organization, twoFactor } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements as platformStatements } from "better-auth/plugins/admin/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { pinLogin } from "@/lib/auth/pin-plugin";
import { sendEmail } from "@/lib/email";

// ---------- POS roles & permissions ----------
// Mirrors the role table in DOCs.MD §3.3. App code authorizes with
// requireMember() (lib/permissions.ts); these statements keep Better Auth's
// own organization endpoints consistent with it.
export const statement = {
  ...defaultStatements, // organization, member, invitation
  product: ["create", "read", "update", "delete"],
  stock: ["read", "adjust"],
  order: ["create", "read", "update", "void", "restore"],
  promotion: ["create", "read", "update", "delete"],
  report: ["read"],
  costProfit: ["read", "write"],
  settings: ["read", "update"],
} as const;

export const ac = createAccessControl(statement);

const allPos = {
  product: ["create", "read", "update", "delete"],
  stock: ["read", "adjust"],
  order: ["create", "read", "update", "void", "restore"],
  promotion: ["create", "read", "update", "delete"],
  report: ["read"],
  costProfit: ["read", "write"],
  settings: ["read", "update"],
} as const;

export const roles = {
  owner: ac.newRole({ ...ownerAc.statements, ...allPos }),
  admin: ac.newRole({ ...adminAc.statements, ...allPos }),
  manager: ac.newRole({
    ...memberAc.statements,
    product: ["create", "read", "update", "delete"],
    stock: ["read", "adjust"],
    order: ["create", "read", "update", "void"],
    promotion: ["create", "read", "update", "delete"],
    report: ["read"],
  }),
  cashier: ac.newRole({
    ...memberAc.statements,
    product: ["read"],
    stock: ["read"],
    order: ["create", "read"],
    promotion: ["read"],
  }),
};

// ---------- Platform (backoffice) roles — Better Auth admin plugin ----------
// Backoffice accounts are created and changed only by scripts/backoffice/*
// (server-side calls without an HTTP session). No role is granted
// user:create / set-role / update / set-password / delete, so none of the
// /api/auth/admin/* HTTP endpoints can create or elevate an account.
// app/api/auth/[...all]/route.ts also rejects those paths outright.
export const platformAc = createAccessControl(platformStatements);
export const platformRoles = {
  user: platformAc.newRole({ user: [], session: [] }),
  support: platformAc.newRole({ user: [], session: [] }),
  super_admin: platformAc.newRole({
    user: ["list", "get", "ban", "impersonate"],
    session: ["list", "revoke"],
  }),
};

/** Impersonation sessions last at most 30 minutes. */
export const IMPERSONATION_SECONDS = 30 * 60;

// ---------- Better Auth ----------
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema, // must contain: user, session, account, verification, organization, member, invitation
  }),
  advanced: {
    database: { generateId: "uuid" }, // matches uuid() columns in auth-schema.ts
  },
  user: {
    additionalFields: {
      // Set by scripts/backoffice/create-user when it generates a password.
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    // No public sign-up: owners join through invite links (features/auth/actions.ts).
    disableSignUp: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Talad POS — reset your password / รีเซ็ตรหัสผ่าน",
        text: `Reset your password / ตั้งรหัสผ่านใหม่:\n${url}`,
      });
    },
  },
  plugins: [
    organization({
      ac,
      roles,
      creatorRole: "owner",
      // Shops are created by our own actions so entitlements (maxShops) apply.
      allowUserToCreateOrganization: false,
      // Staff are created in Settings → Staff (maxStaffPerShop, PIN login).
      organizationHooks: {
        beforeCreateInvitation: async () => {
          throw new Error("Invitations are disabled; add staff in Settings.");
        },
      },
      schema: {
        organization: {
          additionalFields: {
            plan: { type: "string", defaultValue: "free", input: false },
            status: { type: "string", defaultValue: "trial", input: false },
            trialEndsAt: { type: "date", required: false, input: false },
            currency: { type: "string", defaultValue: "THB" },
            timezone: { type: "string", defaultValue: "Asia/Bangkok" },
          },
        },
      },
    }),
    admin({
      ac: platformAc,
      roles: platformRoles,
      defaultRole: "user",
      adminRoles: ["super_admin"],
      impersonationSessionDuration: IMPERSONATION_SECONDS,
    }),
    // Backoffice accounts must enroll TOTP; shop accounts never enable it.
    twoFactor({ issuer: "Talad POS Backoffice" }),
    pinLogin(),
    nextCookies(), // must stay last
  ],
  databaseHooks: {
    session: {
      create: {
        // On login, auto-select the user's first shop so the POS opens straight away.
        // PIN logins already set the device's shop.
        before: async (session) => {
          if (session.activeOrganizationId) return { data: session };
          const [first] = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .orderBy(asc(schema.member.createdAt))
            .limit(1);
          return {
            data: {
              ...session,
              activeOrganizationId: first?.organizationId ?? null,
            },
          };
        },
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
