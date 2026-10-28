import "server-only";
import { randomBytes } from "node:crypto";
import type { Tx } from "@/db";
import { member, organization, shopSettings } from "@/db/schema";

function slugFor(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return `${base || "shop"}-${randomBytes(4).toString("hex")}`;
}

/** Create a shop (organization) with default settings and its owner membership. */
export async function createShopTx(
  tx: Tx,
  input: { ownerId: string; name: string },
) {
  const [org] = await tx
    .insert(organization)
    .values({ name: input.name, slug: slugFor(input.name) })
    .returning({ id: organization.id, name: organization.name });
  await tx.insert(member).values({
    organizationId: org.id,
    userId: input.ownerId,
    role: "owner",
  });
  await tx.insert(shopSettings).values({
    organizationId: org.id,
    displayName: input.name,
  });
  return org;
}
