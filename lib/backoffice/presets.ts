import type { EntitlementFeatures, EntitlementLimits } from "@/db/schema";

// Invite presets. They only prefill the create-invite form; every value stays
// editable and the invite stores the final values. Edit here, not in the DB.
// TODO(decision): confirm preset contents with the business team.

export type InvitePreset = {
  limits: EntitlementLimits;
  features: EntitlementFeatures;
};

export const INVITE_PRESETS = {
  starter: {
    limits: { maxShops: 1, maxStaffPerShop: 3, maxProducts: 100 },
    features: {
      promotions: false,
      costProfit: false,
      export: false,
      platformChannels: false,
      multiShop: false,
    },
  },
  standard: {
    limits: { maxShops: 1, maxStaffPerShop: 10, maxProducts: 1000 },
    features: {
      promotions: true,
      costProfit: true,
      export: true,
      platformChannels: true,
      multiShop: false,
    },
  },
  unlimited: {
    limits: { maxShops: null, maxStaffPerShop: null, maxProducts: null },
    features: {
      promotions: true,
      costProfit: true,
      export: true,
      platformChannels: true,
      multiShop: true,
    },
  },
} as const satisfies Record<string, InvitePreset>;

export type InvitePresetKey = keyof typeof INVITE_PRESETS;
export const DEFAULT_PRESET: InvitePresetKey = "standard";

export const FEATURE_KEYS = [
  "promotions",
  "costProfit",
  "export",
  "platformChannels",
  "multiShop",
] as const satisfies readonly (keyof EntitlementFeatures)[];

export const LIMIT_KEYS = [
  "maxShops",
  "maxStaffPerShop",
  "maxProducts",
] as const satisfies readonly (keyof EntitlementLimits)[];

export const LIMIT_MAX: Record<(typeof LIMIT_KEYS)[number], number> = {
  maxShops: 100,
  maxStaffPerShop: 1000,
  maxProducts: 1_000_000,
};
