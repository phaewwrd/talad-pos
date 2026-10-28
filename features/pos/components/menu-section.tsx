"use client";

import { PackageCheck, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { PosBootstrapDTO } from "@/features/orders/types";
import { promotionsForProduct } from "@/lib/promotions/apply";
import { cn } from "@/lib/utils";
import type { Cart } from "../use-cart";
import { ProductCard } from "./product-card";

export function MenuSection({
  data,
  cart,
  loading,
}: {
  data: PosBootstrapDTO | undefined;
  cart: Cart;
  loading: boolean;
}) {
  const t = useTranslations("pos");
  const tc = useTranslations("common");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.products ?? []).filter(
      (p) =>
        (category === "all" || p.categoryId === category) &&
        (!inStockOnly || p.stockQuantity > 0) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)),
    );
  }, [data?.products, category, search, inStockOnly]);

  const now = new Date();
  const categories = (data?.categories ?? []).filter((c) => c.productCount > 0);

  return (
    <section aria-labelledby="menu-title" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="menu-title" className="font-semibold text-lg">
          {t("menu")}{" "}
          <span className="font-normal text-muted-foreground text-sm">
            ({products.length})
          </span>
        </h2>
        <div className="relative ml-auto w-full sm:w-64">
          <Search
            className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchMenu")}
            aria-label={t("searchMenu")}
            className="h-11 rounded-full bg-card pl-9"
          />
        </div>
        <button
          type="button"
          aria-pressed={inStockOnly}
          onClick={() => setInStockOnly((v) => !v)}
          className={cn(
            "flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm",
            inStockOnly && "border-primary text-primary",
          )}
        >
          <PackageCheck className="size-4" aria-hidden /> {t("inStockOnly")}
        </button>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div
          className="flex w-max gap-2 pb-1"
          role="tablist"
          aria-label={t("categories")}
        >
          {[{ id: "all", name: tc("all") }, ...categories].map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "h-10 whitespace-nowrap rounded-full border bg-card px-4 text-sm transition-colors",
                category === c.id &&
                  "border-primary bg-primary text-primary-foreground",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 8 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeletons
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState title={t("noProducts")} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              quantity={cart.state.quantities[p.id] ?? 0}
              promoName={
                promotionsForProduct(
                  cart.rules,
                  { productId: p.id, categoryId: p.categoryId },
                  now,
                )[0]?.name ?? null
              }
              onAdd={() =>
                cart.dispatch({
                  type: "add",
                  productId: p.id,
                  max: p.stockQuantity,
                })
              }
              onSet={(quantity) =>
                cart.dispatch({
                  type: "set",
                  productId: p.id,
                  quantity,
                  max: p.stockQuantity,
                })
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
