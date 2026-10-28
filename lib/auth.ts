import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

// ---------- POS roles & permissions ----------
export const statement = {
  ...defaultStatements, // organization, member, invitation
  product: ["create", "read", "update", "delete"],
  stock: ["read", "adjust"],
  order: ["create", "read", "void"],
  promotion: ["create", "read", "update", "delete"],
  report: ["read"],
} as const;

export const ac = createAccessControl(statement);

const allPos = {
  product: ["create", "read", "update", "delete"],
  stock: ["read", "adjust"],
  order: ["create", "read", "void"],
  promotion: ["create", "read", "update", "delete"],
  report: ["read"],
} as const;

export const roles = {
  owner: ac.newRole({ ...ownerAc.statements, ...allPos }),
  admin: ac.newRole({ ...adminAc.statements, ...allPos }),
  manager: ac.newRole({
    ...memberAc.statements,
    product: ["create", "read", "update"],
    stock: ["read", "adjust"],
    order: ["create", "read", "void"],
    promotion: ["create", "read", "update"],
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

// ---------- Better Auth ----------
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema, // must contain: user, session, account, verification, organization, member, invitation
  }),
  advanced: {
    database: { generateId: "uuid" }, // matches uuid() columns in auth-schema.ts
  },
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      ac,
      roles,
      creatorRole: "owner", // whoever signs up a shop owns it
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
  ],
  databaseHooks: {
    session: {
      create: {
        // On login, auto-select the user's first shop so the POS opens straight away.
        before: async (session) => {
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

// ---------- Helper: use at the top of every POS route / server action ----------
type Permissions = {
  [K in keyof typeof statement]?: (typeof statement)[K][number][];
};

export async function requireShop(headers: Headers, permissions?: Permissions) {
  const result = await auth.api.getSession({ headers });
  if (!result) throw new Error("UNAUTHORIZED");

  const organizationId = result.session.activeOrganizationId;
  if (!organizationId) throw new Error("NO_ACTIVE_SHOP");

  if (permissions) {
    const { success } = await auth.api.hasPermission({
      headers,
      body: { permissions },
    });
    if (!success) throw new Error("FORBIDDEN");
  }

  return { userId: result.user.id, organizationId };
}

/* Usage:
  const { organizationId, userId } = await requireShop(req.headers, { order: ["create"] });
  const list = await db.query.products.findMany({
    where: (p, { and, eq }) => and(eq(p.organizationId, organizationId), eq(p.isActive, true)),
  });
*/
