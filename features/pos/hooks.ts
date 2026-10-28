"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  OrderListItemDTO,
  PosBootstrapDTO,
} from "@/features/orders/types";
import { getJson } from "@/lib/api/client";

export const posKeys = {
  bootstrap: (orgId: string) => ["pos", orgId] as const,
  activeOrders: (orgId: string) => ["orders", orgId, "active"] as const,
};

export function usePosBootstrap(orgId: string) {
  return useQuery({
    queryKey: posKeys.bootstrap(orgId),
    queryFn: () => getJson<PosBootstrapDTO>("/api/pos/bootstrap"),
    refetchInterval: 60_000,
  });
}

export function useActiveOrders(orgId: string) {
  return useQuery({
    queryKey: posKeys.activeOrders(orgId),
    queryFn: () => getJson<OrderListItemDTO[]>("/api/orders", { active: "1" }),
    refetchInterval: 20_000,
  });
}
