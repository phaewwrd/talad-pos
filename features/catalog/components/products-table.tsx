"use client";

import { Pencil, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { ProductThumb } from "@/components/common/product-thumb";
import { type DataColumn, DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMoney } from "@/lib/format";
import type { MemberRole } from "@/lib/roles";
import { useCategories, useProducts } from "../hooks";
import type { ProductDTO } from "../types";
import { ProductSheet } from "./product-sheet";

export function ProductsTable({
  orgId,
  role,
}: {
  orgId: string;
  role: MemberRole;
}) {
  const t = useTranslations("products");
  const money = useMoney();
  const products = useProducts(orgId);
  const categories = useCategories(orgId);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProductDTO | null>(null);
  const [open, setOpen] = useState(false);
  const canEdit = role !== "cashier";
  const showCost = role !== "cashier";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.data;
    return products.data?.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products.data, search]);

  const columns = useMemo<DataColumn<ProductDTO>[]>(() => {
    const cols: DataColumn<ProductDTO>[] = [
      {
        id: "name",
        accessorFn: (p) => p.name,
        header: t("name"),
        cell: ({ row }) => (
          <div className="flex min-w-48 items-center gap-3">
            <ProductThumb src={row.original.imageUrl} />
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.name}</p>
              <p className="text-muted-foreground text-xs">
                {row.original.sku}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "category",
        accessorFn: (p) => p.categoryName,
        header: t("category"),
      },
      {
        id: "price",
        accessorFn: (p) => Number(p.price),
        header: t("price"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="font-medium text-gold-text">
            {money(row.original.price)}
          </span>
        ),
      },
    ];
    if (showCost) {
      cols.push({
        id: "cost",
        accessorFn: (p) => Number(p.cost ?? 0),
        header: t("cost"),
        meta: { align: "right" },
        cell: ({ row }) => money(row.original.cost),
      });
    }
    cols.push(
      {
        id: "stock",
        accessorFn: (p) => p.stockQuantity,
        header: t("stock"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const p = row.original;
          const variant =
            p.stockQuantity === 0
              ? "destructive"
              : p.stockQuantity <= p.minimumStock
                ? "outline"
                : "secondary";
          return (
            <Badge variant={variant} className="rounded-full tabular-nums">
              {p.stockQuantity}
            </Badge>
          );
        },
      },
      {
        id: "status",
        accessorFn: (p) => (p.isActive ? 1 : 0),
        header: t("status"),
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge className="rounded-full bg-success/15 text-success">
              {t("active")}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="rounded-full text-muted-foreground"
            >
              {t("inactive")}
            </Badge>
          ),
      },
    );
    if (canEdit) {
      cols.push({
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full"
            aria-label={t("editProduct")}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(row.original);
              setOpen(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>
        ),
      });
    }
    return cols;
  }, [t, money, showCost, canEdit]);

  const noCategories = categories.data?.length === 0;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-11 rounded-full pl-9"
          />
        </div>
        {canEdit && (
          <Button
            className="ml-auto h-11 rounded-full"
            disabled={noCategories}
            title={noCategories ? t("needCategory") : undefined}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> {t("newProduct")}
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        loading={products.isPending}
        onRowClick={
          canEdit
            ? (p) => {
                setEditing(p);
                setOpen(true);
              }
            : undefined
        }
        empty={
          <EmptyState
            title={t("empty")}
            description={noCategories ? t("needCategory") : undefined}
          />
        }
      />
      {canEdit && (
        <ProductSheet
          key={editing?.id ?? "new"}
          orgId={orgId}
          open={open}
          onOpenChange={setOpen}
          product={editing}
          categories={categories.data ?? []}
          showCost={showCost}
        />
      )}
    </div>
  );
}
