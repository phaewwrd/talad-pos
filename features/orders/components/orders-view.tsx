"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { StatusPill } from "@/components/common/status-pill";
import { type DataColumn, DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ORDER_STATUSES } from "@/db/app-schema";
import { useRouter } from "@/i18n/navigation";
import { useDateTime, useMoney } from "@/lib/format";
import type { MemberRole } from "@/lib/roles";
import { addDays, bangkokDateString } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useOrders } from "../hooks";
import { type OrderFilters, PAYMENT_METHODS, SALES_CHANNELS } from "../schemas";
import type { OrderListItemDTO } from "../types";
import { OrderActions } from "./order-actions";

const ALL = "__all";

export function OrdersView({
  orgId,
  role,
  userId,
}: {
  orgId: string;
  role: MemberRole;
  userId: string;
}) {
  const t = useTranslations("orders");
  const ts = useTranslations("orderStatus");
  const tc = useTranslations("channels");
  const tp = useTranslations("paymentType");
  const tm = useTranslations("paymentMethod");
  const money = useMoney();
  const { dateTime } = useDateTime();
  const router = useRouter();
  const today = bangkokDateString(new Date());
  const [filters, setFilters] = useState<OrderFilters>({
    from: bangkokDateString(addDays(new Date(), -6)),
    to: today,
  });
  const [search, setSearch] = useState("");
  const query = useOrders(orgId, { ...filters, q: search.trim() || undefined });
  const showDeleted = filters.deleted === "1";

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of query.data ?? [])
      if (o.staffId && o.staffName) map.set(o.staffId, o.staffName);
    return [...map];
  }, [query.data]);

  const set = <K extends keyof OrderFilters>(
    key: K,
    value: OrderFilters[K] | typeof ALL,
  ) => setFilters((f) => ({ ...f, [key]: value === ALL ? undefined : value }));

  const columns = useMemo<DataColumn<OrderListItemDTO>[]>(
    () => [
      {
        id: "orderNumber",
        accessorFn: (o) => o.orderNumber,
        header: t("orderNumber"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-medium">
            {row.original.orderNumber}
          </span>
        ),
      },
      {
        id: "time",
        accessorFn: (o) => o.createdAt,
        header: t("time"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {dateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "customer",
        accessorFn: (o) => o.customerName,
        header: t("customer"),
        cell: ({ row }) => (
          <div className="min-w-28">
            <p className="truncate">{row.original.customerName}</p>
            <p className="text-muted-foreground text-xs">
              {tc(row.original.salesChannel)}
            </p>
          </div>
        ),
      },
      {
        id: "items",
        accessorFn: (o) => o.itemCount,
        header: t("items"),
        meta: { align: "right" },
      },
      {
        id: "total",
        accessorFn: (o) => Number(o.total),
        header: t("total"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="font-semibold text-gold-text">
            {money(row.original.total)}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (o) => o.status,
        header: t("status"),
        cell: ({ row }) => <StatusPill status={row.original.status} />,
      },
      {
        id: "payment",
        accessorFn: (o) => o.paymentType,
        header: t("payment"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              "whitespace-nowrap rounded-full",
              row.original.paymentType === "Unpaid" &&
                "border-warning text-[#9a6608]",
            )}
          >
            {tp(row.original.paymentType)}
            {row.original.paymentMethod &&
              ` · ${tm(row.original.paymentMethod)}`}
          </Badge>
        ),
      },
      {
        id: "staff",
        accessorFn: (o) => o.staffName ?? "—",
        header: t("staff"),
      },
      ...(showDeleted
        ? [
            {
              id: "deleteReason",
              accessorFn: (o: OrderListItemDTO) => o.deleteReason ?? "",
              header: t("deleteReason"),
            } satisfies DataColumn<OrderListItemDTO>,
          ]
        : []),
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <OrderActions
            orgId={orgId}
            order={row.original}
            role={role}
            userId={userId}
          />
        ),
      },
    ],
    [t, tc, tp, tm, money, dateTime, orgId, role, userId, showDeleted],
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <FilterField label={t("from")}>
            <Input
              type="date"
              value={filters.from ?? ""}
              max={filters.to}
              onChange={(e) => set("from", e.target.value || undefined)}
              className="h-10 rounded-xl"
            />
          </FilterField>
          <FilterField label={t("to")}>
            <Input
              type="date"
              value={filters.to ?? ""}
              min={filters.from}
              onChange={(e) => set("to", e.target.value || undefined)}
              className="h-10 rounded-xl"
            />
          </FilterField>
          <FilterSelect
            label={t("status")}
            value={filters.status}
            onChange={(v) => set("status", v as OrderFilters["status"])}
            options={ORDER_STATUSES.map((s) => [s, ts(s)])}
            allLabel={t("all")}
          />
          <FilterSelect
            label={t("channel")}
            value={filters.channel}
            onChange={(v) => set("channel", v as OrderFilters["channel"])}
            options={SALES_CHANNELS.map((c) => [c, tc(c)])}
            allLabel={t("all")}
          />
          <FilterSelect
            label={t("paymentType")}
            value={filters.paymentType}
            onChange={(v) =>
              set("paymentType", v as OrderFilters["paymentType"])
            }
            options={(["Paid", "Unpaid"] as const).map((p) => [p, tp(p)])}
            allLabel={t("all")}
          />
          <FilterSelect
            label={t("paymentMethod")}
            value={filters.paymentMethod}
            onChange={(v) =>
              set("paymentMethod", v as OrderFilters["paymentMethod"])
            }
            options={PAYMENT_METHODS.map((m) => [m, tm(m)])}
            allLabel={t("all")}
          />
          <FilterSelect
            label={t("staff")}
            value={filters.staffId}
            onChange={(v) => set("staffId", v)}
            options={staffOptions}
            allLabel={t("all")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          {role === "owner" && (
            <div className="ml-auto flex items-center gap-2">
              <Switch
                id="show-deleted"
                checked={showDeleted}
                onCheckedChange={(v) => set("deleted", v ? "1" : undefined)}
              />
              <Label htmlFor="show-deleted">{t("showDeleted")}</Label>
            </div>
          )}
        </div>
      </div>
      <DataTable
        columns={columns}
        data={query.data}
        loading={query.isPending}
        onRowClick={(o) => router.push(`/orders/${o.id}`)}
        rowClassName={(o) => (o.deletedAt ? "opacity-70" : undefined)}
        empty={<EmptyState title={t("empty")} />}
      />
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: (readonly [string, string])[];
  allLabel: string;
}) {
  return (
    <FilterField label={label}>
      <Select value={value ?? ALL} onValueChange={onChange}>
        <SelectTrigger className="h-10 w-full rounded-xl" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
