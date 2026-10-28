"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson } from "@/lib/api/client";
import type { Entitlements } from "@/lib/entitlements";
import type { DeviceDTO, SettingsDTO, StaffDTO } from "./queries";

export type SettingsBundle = {
  settings: SettingsDTO | null;
  staff: StaffDTO[];
  devices: DeviceDTO[];
  shops: { id: string; name: string; createdAt: string }[];
  entitlements: Entitlements;
  activeShopId: string;
};

export const settingsKey = (orgId: string) => ["settings", orgId] as const;

export function useSettings(orgId: string) {
  return useQuery({
    queryKey: settingsKey(orgId),
    queryFn: () => getJson<SettingsBundle>("/api/settings"),
  });
}

export function useInvalidateSettings(orgId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: settingsKey(orgId) });
    qc.invalidateQueries({ queryKey: ["pos", orgId] });
  };
}

export function issuesToFields(
  issues: { path: PropertyKey[]; message: string }[],
) {
  return {
    fields: Object.fromEntries(
      issues.map((i) => [String(i.path[0]), { message: i.message }]),
    ),
  };
}
