import * as z from "zod";

const limit = (max: number) =>
  z.coerce
    .number({ error: "number" })
    .int({ error: "integer" })
    .min(1, { error: "positive" })
    .max(max);

export const createInviteSchema = z.object({
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
  expiresInDays: limit(365),
  limits: z.object({
    maxShops: limit(50),
    maxStaffPerShop: limit(200),
    maxProducts: limit(100_000),
  }),
  features: z.object({
    promotions: z.boolean(),
    costProfit: z.boolean(),
    export: z.boolean(),
    platformChannels: z.boolean(),
    multiShop: z.boolean(),
  }),
});
export type CreateInviteInput = z.input<typeof createInviteSchema>;
