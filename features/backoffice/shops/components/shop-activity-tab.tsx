"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson } from "@/lib/api/client";
import { AuditEntryList } from "../../components/audit-entry-list";
import type { ShopActivityDTO } from "../queries";

export const shopActivityKey = (id: string) =>
  ["backoffice", "shops", id, "activity"] as const;

export function useShopActivity(shopId: string) {
  return useQuery({
    queryKey: shopActivityKey(shopId),
    queryFn: () =>
      getJson<ShopActivityDTO[]>(`/api/backoffice/shops/${shopId}/activity`),
  });
}

export function ShopActivityTab({ shopId }: { shopId: string }) {
  const activity = useShopActivity(shopId);
  if (activity.isPending) return <Skeleton className="h-64 rounded-2xl" />;
  return <AuditEntryList entries={activity.data ?? []} />;
}
