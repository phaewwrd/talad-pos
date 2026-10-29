"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson } from "@/lib/api/client";
import type { SuppliersBundle } from "./types";

export const suppliersKey = (orgId: string) => ["suppliers", orgId] as const;

export function useSuppliers(orgId: string) {
  return useQuery({
    queryKey: suppliersKey(orgId),
    queryFn: () => getJson<SuppliersBundle>("/api/suppliers"),
  });
}

export function useInvalidateSuppliers(orgId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: suppliersKey(orgId) });
}
