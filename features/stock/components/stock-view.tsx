"use client";

import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  PackageX,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { ProductThumb } from "@/components/common/product-thumb";
import { StatCard } from "@/components/common/stat-card";
import { type DataColumn, DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDateTime, useMoney } from "@/lib/format";
import type { MemberRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useStock, useStockMovements } from "../hooks";
import type { StockMovementDTO, StockProductDTO } from "../types";
import { AdjustStockDialog, StockInDialog } from "./stock-dialogs";

type Filter = "all" | "low" | "out" | "expiring";

export function StockView({
  orgId,
  role,
}: {
  orgId: string;
  role: MemberRole;
}) {
  const t = useTranslations("stock");
  const stock = useStock(orgId);
  const [filter, setFilter] = useState<Filter>("all");
  const [detail, setDetail] = useState<StockProductDTO | null>(null);
  const [stockInFor, setStockInFor] = useState<
    StockProductDTO | null | undefined
  >(undefined);
  const [adjustFor, setAdjustFor] = useState<StockProductDTO | null>(null);
  const canAdjust = role !== "cashier";
  const overview = stock.data?.overview;
  const products = stock.data?.products ?? [];

  const filtered = useMemo(() => {
    switch (filter) {
      case "low":
        return products.filter(
          (p) => p.stockQuantity > 0 && p.stockQuantity <= p.minimumStock,
        );
      case "out":
        return products.filter((p) => p.stockQuantity === 0);
      case "expiring":
        return products.filter((p) =>
          p.lots.some((l) => l.expiringSoon || l.expired),
        );
      default:
        return products;
    }
  }, [products, filter]);

  const columns = useMemo<DataColumn<StockProductDTO>[]>(
    () => [
      {
        id: "name",
        accessorFn: (p) => p.name,
        header: t("product"),
        cell: ({ row }) => (
          <div className="flex min-w-48 items-center gap-3">
            <ProductThumb src={row.original.imageUrl} />
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.name}</p>
              <p className="text-muted-foreground text-xs">
                {row.original.sku} · {row.original.categoryName}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "lots",
        accessorFn: (p) => p.lots.filter((l) => l.remainingQuantity > 0).length,
        header: t("activeLots"),
        meta: { align: "right" },
      },
      {
        id: "alerts",
        header: t("alerts"),
        enableSorting: false,
        cell: ({ row }) => <StockBadges product={row.original} />,
      },
      {
        id: "stock",
        accessorFn: (p) => p.stockQuantity,
        header: t("onHand"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="font-semibold">
            {row.original.stockQuantity}
            <span className="font-normal text-muted-foreground text-xs">
              {" "}
              / {row.original.minimumStock}
            </span>
          </span>
        ),
      },
    ],
    [t],
  );

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "low", label: t("lowStock") },
    { key: "out", label: t("outOfStock") },
    { key: "expiring", label: t("expiringSoon") },
  ];

  return (
    <Tabs defaultValue="stock">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TabsList className="h-11 rounded-full p-1">
          <TabsTrigger value="stock" className="rounded-full px-4">
            {t("tabStock")}
          </TabsTrigger>
          <TabsTrigger value="movements" className="rounded-full px-4">
            {t("tabMovements")}
          </TabsTrigger>
        </TabsList>
        {canAdjust && (
          <Button
            className="ml-auto h-11 rounded-full"
            disabled={products.length === 0}
            onClick={() => setStockInFor(null)}
          >
            <Plus className="size-4" /> {t("stockIn")}
          </Button>
        )}
      </div>

      <TabsContent value="stock" className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={t("totalSkus")}
            value={overview?.totalSkus ?? 0}
            icon={Boxes}
            loading={stock.isPending}
          />
          <StatCard
            label={t("lowStock")}
            value={overview?.lowStock ?? 0}
            icon={AlertTriangle}
            tone="warning"
            loading={stock.isPending}
          />
          <StatCard
            label={t("outOfStock")}
            value={overview?.outOfStock ?? 0}
            icon={PackageX}
            tone="danger"
            loading={stock.isPending}
          />
          <StatCard
            label={t("expiringSoon")}
            value={overview?.expiringSoon ?? 0}
            icon={CalendarClock}
            tone="gold"
            loading={stock.isPending}
            hint={
              overview
                ? t("withinDays", { days: overview.expiryAlertDays })
                : undefined
            }
          />
        </div>
        <fieldset className="flex flex-wrap gap-2" aria-label={t("filter")}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-10 rounded-full border bg-card px-4 text-sm",
                filter === f.key &&
                  "border-primary bg-primary text-primary-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </fieldset>
        <DataTable
          columns={columns}
          data={filtered}
          loading={stock.isPending}
          onRowClick={setDetail}
          empty={<EmptyState title={t("empty")} />}
        />
      </TabsContent>

      <TabsContent value="movements">
        <MovementsTable orgId={orgId} />
      </TabsContent>

      <LotsSheet
        product={detail}
        onOpenChange={(open) => !open && setDetail(null)}
        canAdjust={canAdjust}
        onStockIn={(p) => setStockInFor(p)}
        onAdjust={(p) => setAdjustFor(p)}
      />
      {stockInFor !== undefined && (
        <StockInDialog
          key={stockInFor?.id ?? "any"}
          orgId={orgId}
          product={stockInFor}
          products={products}
          open
          onOpenChange={(open) => !open && setStockInFor(undefined)}
        />
      )}
      {adjustFor && (
        <AdjustStockDialog
          key={adjustFor.id}
          orgId={orgId}
          product={products.find((p) => p.id === adjustFor.id) ?? adjustFor}
          open
          onOpenChange={(open) => !open && setAdjustFor(null)}
        />
      )}
    </Tabs>
  );
}

function StockBadges({ product }: { product: StockProductDTO }) {
  const t = useTranslations("stock");
  const expiring = product.lots.some((l) => l.expiringSoon);
  const expired = product.lots.some((l) => l.expired);
  return (
    <div className="flex flex-wrap gap-1">
      {product.stockQuantity === 0 ? (
        <Badge variant="destructive" className="rounded-full">
          {t("outOfStock")}
        </Badge>
      ) : product.stockQuantity <= product.minimumStock ? (
        <Badge className="rounded-full bg-warning/15 text-warning">
          {t("lowStock")}
        </Badge>
      ) : null}
      {expired && (
        <Badge
          variant="outline"
          className="rounded-full border-primary text-primary"
        >
          {t("expired")}
        </Badge>
      )}
      {expiring && (
        <Badge className="rounded-full bg-gold-soft text-gold-text">
          {t("expiringSoon")}
        </Badge>
      )}
      {!product.isActive && (
        <Badge variant="outline" className="rounded-full">
          {t("inactive")}
        </Badge>
      )}
    </div>
  );
}

function LotsSheet({
  product,
  onOpenChange,
  canAdjust,
  onStockIn,
  onAdjust,
}: {
  product: StockProductDTO | null;
  onOpenChange: (open: boolean) => void;
  canAdjust: boolean;
  onStockIn: (p: StockProductDTO) => void;
  onAdjust: (p: StockProductDTO) => void;
}) {
  const t = useTranslations("stock");
  const money = useMoney();
  const { date } = useDateTime();
  return (
    <Sheet open={product !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {product && (
          <>
            <SheetHeader>
              <SheetTitle>{product.name}</SheetTitle>
              <SheetDescription>
                {t("onHand")}: {product.stockQuantity} · {t("minimum")}:{" "}
                {product.minimumStock}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-3 px-4 pb-6">
              {canAdjust && (
                <div className="flex gap-2">
                  <Button
                    className="h-11 flex-1 rounded-full"
                    onClick={() => onStockIn(product)}
                  >
                    <Plus className="size-4" /> {t("stockIn")}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 flex-1 rounded-full"
                    disabled={product.lots.length === 0}
                    onClick={() => onAdjust(product)}
                  >
                    <SlidersHorizontal className="size-4" /> {t("adjust")}
                  </Button>
                </div>
              )}
              {product.lots.length === 0 ? (
                <EmptyState title={t("noLots")} />
              ) : (
                <ol className="grid gap-2" aria-label={t("lotsFifo")}>
                  {product.lots.map((lot, i) => (
                    <li
                      key={lot.id}
                      className={cn(
                        "rounded-2xl border bg-card p-3",
                        lot.remainingQuantity === 0 && "opacity-60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {i + 1}. {lot.lotNumber}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {lot.remainingQuantity}
                          <span className="font-normal text-muted-foreground text-xs">
                            {" "}
                            / {lot.initialQuantity}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
                        <span>
                          {t("stockInDate")}: {date(lot.stockInDate)}
                        </span>
                        {lot.expiryDate && (
                          <span
                            className={cn(
                              lot.expired && "text-primary",
                              lot.expiringSoon && "text-gold-text",
                            )}
                          >
                            {t("expiryDate")}: {date(lot.expiryDate)}
                          </span>
                        )}
                        {lot.cost !== undefined && (
                          <span>
                            {t("unitCost")}: {money(lot.cost)}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MovementsTable({ orgId }: { orgId: string }) {
  const t = useTranslations("stock");
  const { dateTime } = useDateTime();
  const movements = useStockMovements(orgId);
  const columns = useMemo<DataColumn<StockMovementDTO>[]>(
    () => [
      {
        id: "time",
        accessorFn: (m) => m.createdAt,
        header: t("time"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {dateTime(row.original.createdAt)}
          </span>
        ),
      },
      { id: "product", accessorFn: (m) => m.productName, header: t("product") },
      { id: "lot", accessorFn: (m) => m.lotNumber ?? "—", header: t("lot") },
      {
        id: "type",
        accessorFn: (m) => m.type,
        header: t("adjustType"),
        cell: ({ row }) => (
          <Badge variant="outline" className="rounded-full">
            {t(`types.${row.original.type}`)}
          </Badge>
        ),
      },
      {
        id: "qty",
        accessorFn: (m) => m.quantity,
        header: t("quantity"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <span
            className={cn(
              "font-semibold",
              row.original.quantity > 0 ? "text-success" : "text-primary",
            )}
          >
            {row.original.quantity > 0
              ? `+${row.original.quantity}`
              : row.original.quantity}
          </span>
        ),
      },
      { id: "reason", accessorFn: (m) => m.reason ?? "", header: t("reason") },
      { id: "actor", accessorFn: (m) => m.actorName ?? "—", header: t("by") },
    ],
    [t, dateTime],
  );
  return (
    <DataTable
      columns={columns}
      data={movements.data}
      loading={movements.isPending}
    />
  );
}
