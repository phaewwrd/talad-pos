import * as z from "zod";
import { listParamsSchema } from "@/lib/backoffice/list-params";
import { reasonSchema } from "../shared/entitlement-schemas";

export const OWNER_SORTS = [
  "email",
  "name",
  "shops",
  "createdAt",
  "lastLoginAt",
] as const;

export const ownerListSchema = listParamsSchema.extend({
  banned: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(OWNER_SORTS).optional(),
});
export type OwnerListParams = z.output<typeof ownerListSchema>;

export const banOwnerSchema = z.object({
  userId: z.uuid(),
  reason: reasonSchema,
});
export const unbanOwnerSchema = banOwnerSchema;
export const passwordResetSchema = z.object({
  userId: z.uuid(),
  locale: z.enum(["th", "en"]).default("th"),
});
export const impersonateOwnerSchema = z.object({
  userId: z.uuid(),
  organizationId: z.uuid(),
  reason: reasonSchema,
});
