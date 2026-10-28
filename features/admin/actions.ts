"use server";

import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { signupInvites } from "@/db/schema";
import { hashToken } from "@/lib/devices";
import { AppError, runAction } from "@/lib/errors";
import { requirePlatformAdmin } from "@/lib/permissions";
import { uuid } from "@/lib/schemas";
import { addDays } from "@/lib/time";
import { createInviteSchema } from "./schemas";

/** Create a signup link. The raw token is returned once; only its hash is stored. */
export async function createInvite(raw: unknown) {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const r = createInviteSchema.safeParse(raw);
    if (!r.success) throw new AppError("VALIDATION");
    const input = r.data;
    const token = randomBytes(24).toString("base64url");
    const [row] = await db
      .insert(signupInvites)
      .values({
        tokenHash: hashToken(token),
        label: input.label,
        email: input.email,
        limits: input.limits,
        features: input.features,
        expiresAt: addDays(new Date(), input.expiresInDays),
        createdBy: admin.id,
      })
      .returning({ id: signupInvites.id });
    return { id: row.id, token };
  });
}

export async function revokeInvite(id: unknown) {
  return runAction(async () => {
    await requirePlatformAdmin();
    const inviteId = uuid.parse(id);
    const [row] = await db
      .update(signupInvites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(signupInvites.id, inviteId),
          isNull(signupInvites.usedAt),
          isNull(signupInvites.revokedAt),
        ),
      )
      .returning({ id: signupInvites.id });
    if (!row) throw new AppError("NOT_FOUND");
    return row;
  });
}
