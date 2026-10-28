import * as z from "zod";
import { SHOP_STATUSES } from "@/db/schema";
import { listParamsSchema } from "@/lib/backoffice/list-params";
import {
  featuresSchema,
  limitsSchema,
  reasonSchema,
} from "../shared/entitlement-schemas";

export const SHOP_SORTS = [
  "name",
  "ownerEmail",
  "status",
  "staff",
  "products",
  "orders30d",
  "gmv30d",
  "createdAt",
  "lastActivityAt",
] as const;

export const shopListSchema = listParamsSchema.extend({
  status: z.enum(SHOP_STATUSES).optional(),
  nearLimit: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  ownerId: z.uuid().optional(),
  sort: z.enum(SHOP_SORTS).optional(),
});
export type ShopListParams = z.output<typeof shopListSchema>;

export const updateEntitlementsSchema = z.object({
  organizationId: z.uuid(),
  limits: limitsSchema,
  features: featuresSchema,
  reason: reasonSchema,
});

export const changeShopStatusSchema = z.discriminatedUnion("status", [
  z.object({
    organizationId: z.uuid(),
    status: z.literal("suspended"),
    reason: reasonSchema,
  }),
  z.object({
    organizationId: z.uuid(),
    status: z.literal("active"),
    reason: reasonSchema,
  }),
  z.object({
    organizationId: z.uuid(),
    status: z.literal("closed"),
    reason: reasonSchema,
    /** Must equal the shop name exactly. */
    confirmName: z.string(),
  }),
]);
export type ChangeShopStatusInput = z.input<typeof changeShopStatusSchema>;

export const revokeDeviceSchema = z.object({
  organizationId: z.uuid(),
  deviceId: z.uuid(),
  reason: reasonSchema,
});

export const ownerTargetSchema = z.object({ userId: z.uuid() });
export const impersonateSchema = z.object({
  userId: z.uuid(),
  organizationId: z.uuid(),
  reason: reasonSchema,
});
