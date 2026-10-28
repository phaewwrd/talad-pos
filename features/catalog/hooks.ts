"use client";

import { useQuery } from "@tanstack/react-query";
import { getJson } from "@/lib/api/client";
import type { CategoryDTO, ProductDTO } from "./types";

export const catalogKeys = {
  products: (orgId: string) => ["products", orgId] as const,
  categories: (orgId: string) => ["categories", orgId] as const,
};

export function useProducts(orgId: string) {
  return useQuery({
    queryKey: catalogKeys.products(orgId),
    queryFn: () => getJson<ProductDTO[]>("/api/products"),
  });
}

export function useCategories(orgId: string) {
  return useQuery({
    queryKey: catalogKeys.categories(orgId),
    queryFn: () => getJson<CategoryDTO[]>("/api/categories"),
  });
}
