"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ProductThumb } from "@/components/common/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { setSupplierProducts } from "../actions";
import type { SupplierDTO, SupplierProductOptionDTO } from "../types";
import { useRun } from "../use-run";

export function ProductsDialog({
  orgId,
  open,
  onOpenChange,
  supplier,
  products,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierDTO;
  products: SupplierProductOptionDTO[];
}) {
  const t = useTranslations("suppliers");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col rounded-3xl">
        <DialogHeader>
          <DialogTitle>{t("productsFor", { name: supplier.name })}</DialogTitle>
        </DialogHeader>
        {open && (
          <ProductPicker
            orgId={orgId}
            supplier={supplier}
            products={products}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProductPicker({
  orgId,
  supplier,
  products,
  onDone,
}: {
  orgId: string;
  supplier: SupplierDTO;
  products: SupplierProductOptionDTO[];
  onDone: () => void;
}) {
  const t = useTranslations("suppliers");
  const run = useRun(orgId);
  const [selected, setSelected] = useState(() => new Set(supplier.productIds));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
        )
      : products;
  }, [products, query]);

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <>
      <div className="relative">
        <Search
          className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchProducts")}
          aria-label={t("searchProducts")}
          className="h-11 rounded-full pl-9"
        />
      </div>
      <ul className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
        {visible.length === 0 ? (
          <li className="py-8 text-center text-muted-foreground text-sm">
            {t("noProductsFound")}
          </li>
        ) : (
          visible.map((p) => (
            <li key={p.id}>
              <label
                htmlFor={`sp-${p.id}`}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
              >
                <Checkbox
                  id={`sp-${p.id}`}
                  checked={selected.has(p.id)}
                  onCheckedChange={(v) => toggle(p.id, v === true)}
                />
                <ProductThumb src={p.imageUrl} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="block truncate text-muted-foreground text-xs">
                    {p.sku}
                  </span>
                </span>
                {!p.isActive && (
                  <Badge variant="outline" className="rounded-full">
                    {t("inactiveProduct")}
                  </Badge>
                )}
              </label>
            </li>
          ))
        )}
      </ul>
      <div className="flex items-center gap-2">
        <p className="text-muted-foreground text-sm">
          {t("selectedCount", { count: selected.size })}
        </p>
        <Button
          className="ml-auto h-11 rounded-full"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const ok = await run(
              setSupplierProducts({
                supplierId: supplier.id,
                productIds: [...selected],
              }),
              t("saved"),
            );
            setSaving(false);
            if (ok) onDone();
          }}
        >
          {t("save")}
        </Button>
      </div>
    </>
  );
}
