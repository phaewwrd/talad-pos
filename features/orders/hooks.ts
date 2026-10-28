"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJson } from "@/lib/api/client";
import type { OrderFilters } from "./schemas";
import type { OrderDetailDTO, OrderListItemDTO } from "./types";

export const orderKeys = {
  list: (orgId: string, filters: OrderFilters) =>
    ["orders", orgId, "list", filters] as const,
  detail: (orgId: string, id: string) =>
    ["orders", orgId, "detail", id] as const,
};

export function useOrders(orgId: string, filters: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.list(orgId, filters),
    queryFn: () => getJson<OrderListItemDTO[]>("/api/orders", filters),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(orgId: string, id: string) {
  return useQuery({
    queryKey: orderKeys.detail(orgId, id),
    queryFn: () => getJson<OrderDetailDTO>(`/api/orders/${id}`),
  });
}
