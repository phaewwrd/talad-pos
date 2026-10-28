import * as z from "zod";
import { INVITE_STATUSES } from "@/lib/backoffice/invite-status";
import { listParamsSchema } from "@/lib/backoffice/list-params";
import {
  featuresSchema,
  limitsSchema,
  reasonSchema,
} from "../shared/entitlement-schemas";

export const INVITE_MAX_EXPIRY_DAYS = 30;
export const INVITE_DEFAULT_EXPIRY_DAYS = 7;
export const INVITE_MAX_SENDS_PER_DAY = 5;

const inviteFields = z.object({
  label: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(80, { error: "tooLong" }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      error: "email",
    })
    .transform((v) => v || null),
  lockToEmail: z.boolean(),
  expiresInDays: z
    .number({ error: "number" })
    .int({ error: "integer" })
    .min(1, { error: "positive" })
    .max(INVITE_MAX_EXPIRY_DAYS, { error: "expiryMax" }),
  emailLocale: z.enum(["th", "en"]),
  limits: limitsSchema,
  features: featuresSchema,
});

const lockNeedsEmail = (v: { lockToEmail: boolean; email: string | null }) =>
  !v.lockToEmail || v.email !== null;

export const createInviteSchema = inviteFields
  .extend({ delivery: z.enum(["email", "link"]) })
  .refine(lockNeedsEmail, { error: "lockNeedsEmail", path: ["email"] })
  .refine((v) => v.delivery !== "email" || v.email !== null, {
    error: "emailRequired",
    path: ["email"],
  });
export type CreateInviteInput = z.input<typeof createInviteSchema>;

export const updateInviteSchema = inviteFields
  .extend({ id: z.uuid() })
  .refine(lockNeedsEmail, { error: "lockNeedsEmail", path: ["email"] });
export type UpdateInviteInput = z.input<typeof updateInviteSchema>;

export const inviteIdSchema = z.object({ id: z.uuid() });
export const revokeInviteSchema = z.object({
  id: z.uuid(),
  reason: reasonSchema,
});

export const INVITE_SORTS = [
  "label",
  "email",
  "createdAt",
  "expiresAt",
  "sentAt",
  "sendCount",
] as const;

export const inviteListSchema = listParamsSchema.extend({
  status: z.enum(INVITE_STATUSES).optional(),
  createdBy: z.uuid().optional(),
  sort: z.enum(INVITE_SORTS).optional(),
});
export type InviteListParams = z.output<typeof inviteListSchema>;
