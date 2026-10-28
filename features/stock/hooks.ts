"use client";

import { useQuery } from "@tanstack/react-query";
import { getJson } from "@/lib/api/client";
import type {
  StockMovementDTO,
  StockOverviewDTO,
  StockProductDTO,
} from "./types";

export const stockKeys = {
  all: (orgId: string) => ["stock", orgId] as const,
  movements: (orgId: string) => ["stock", orgId, "movements"] as const,
};

export function useStock(orgId: string) {
  return useQuery({
    queryKey: stockKeys.all(orgId),
    queryFn: () =>
      getJson<{ overview: StockOverviewDTO; products: StockProductDTO[] }>(
        "/api/stock",
      ),
  });
}

export function useStockMovements(orgId: string) {
  return useQuery({
    queryKey: stockKeys.movements(orgId),
    queryFn: () => getJson<StockMovementDTO[]>("/api/stock/movements"),
  });
}
