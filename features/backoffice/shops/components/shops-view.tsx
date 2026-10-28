"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import {
  type ServerColumn,
  ServerDataTable,
  tableQuery,
} from "@/components/data-table/server-data-table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SHOP_STATUSES, type ShopStatus } from "@/db/schema";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Link, useRouter } from "@/i18n/navigation";
import { getJson } from "@/lib/api/client";
import { useDateTime, useMoney } from "@/lib/format";
import {
  DateRangeFilter,
  ExportCsvButton,
  ListToolbar,
  SearchFilter,
  SelectFilter,
  useTableState,
} from "../../components/list-toolbar";
import { ShopStatusChip } from "../../components/status-chip";
import { UsageMeter } from "../../components/usage-meter";
import type { ShopRowDTO } from "../queries";

export function ShopsView() {
  const t = useTranslations("backoffice.shops");
  const ts = useTranslations("backoffice.shopStatus");
  const { date, dateTime } = useDateTime();
  const money = useMoney();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [table, setTable] = useTableState("createdAt");
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState<ShopStatus | "">("");
  const [nearLimit, setNearLimit] = useState(
    searchParams.get("nearLimit") === "true",
  );
  const [range, setRange] = useState({ from: "", to: "" });
  const ownerId = searchParams.get("ownerId") ?? "";
  const search = useDebouncedValue(q.trim());

  const filters = {
    q: search,
    status,
    nearLimit: nearLimit ? "true" : "",
    ownerId,
    from: range.from,
    to: range.to,
  };
  const params = { ...tableQuery(table), ...filters };
  const shops = useQuery({
    queryKey: ["backoffice", "shops", params],
    queryFn: () =>
      getJson<{ rows: ShopRowDTO[]; total: number }>(
        "/api/backoffice/shops",
        params,
      ),
    placeholderData: keepPreviousData,
  });
  const resetPage = () =>
    setTable((s) => ({ ...s, pagination: { ...s.pagination, pageIndex: 0 } }));

  const columns = useMemo<ServerColumn<ShopRowDTO>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: t("shop"),
        cell: ({ row }) => (
          <Link
            href={`/backoffice/shops/${row.original.id}`}
            className="font-medium hover:text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        id: "ownerEmail",
        accessorFn: (r) => r.owner?.email,
        header: t("owner"),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.owner?.email ?? "—"}</span>
        ),
      },
      {
        id: "status",
        accessorFn: (r) => r.status,
        header: t("status"),
        cell: ({ row }) => <ShopStatusChip status={row.original.status} />,
      },
      {
        id: "staff",
        accessorFn: (r) => r.staff.used,
        header: t("staff"),
        cell: ({ row }) => (
          <UsageMeter
            used={row.original.staff.used}
            limit={row.original.staff.limit}
          />
        ),
      },
      {
        id: "products",
        accessorFn: (r) => r.products.used,
        header: t("products"),
        cell: ({ row }) => (
          <UsageMeter
            used={row.original.products.used}
            limit={row.original.products.limit}
          />
        ),
      },
      {
        id: "orders30d",
        accessorKey: "orders30d",
        header: t("orders30d"),
        meta: { align: "right" },
      },
      {
        id: "gmv30d",
        accessorFn: (r) => r.gmv30d,
        header: t("gmv30d"),
        meta: { align: "right" },
        cell: ({ row }) => money(row.original.gmv30d),
      },
      {
        id: "createdAt",
        accessorFn: (r) => r.createdAt,
        header: t("created"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">
            {date(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "lastActivityAt",
        accessorFn: (r) => r.lastActivityAt,
        header: t("lastActivity"),
        cell: ({ row }) =>
          row.original.lastActivityAt ? (
            <span className="whitespace-nowrap text-xs">
              {dateTime(row.original.lastActivityAt)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [t, date, dateTime, money],
  );

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <ExportCsvButton
            href="/api/backoffice/shops/export"
            params={{ ...filters, sort: params.sort, dir: params.dir }}
          />
        }
      />
      <ListToolbar>
        <SearchFilter
          value={q}
          onChange={(v) => {
            setQ(v);
            resetPage();
          }}
          placeholder={t("searchPlaceholder")}
        />
        <SelectFilter
          label={t("status")}
          value={status}
          onChange={(v) => {
            setStatus(v);
            resetPage();
          }}
          options={SHOP_STATUSES.map((s) => ({ value: s, label: ts(s) }))}
        />
        <DateRangeFilter
          label={t("createdRange")}
          from={range.from}
          to={range.to}
          onChange={(r) => {
            setRange(r);
            resetPage();
          }}
        />
        <div className="flex h-10 items-center gap-2 rounded-full border px-3">
          <Switch
            id="near-limit"
            checked={nearLimit}
            onCheckedChange={(v) => {
              setNearLimit(v);
              resetPage();
            }}
          />
          <Label htmlFor="near-limit" className="font-normal text-sm">
            {t("nearLimit")}
          </Label>
        </div>
      </ListToolbar>
      {ownerId && (
        <p className="mb-3 text-muted-foreground text-sm">
          {t("filteredByOwner")}{" "}
          <Link href="/backoffice/shops" className="text-gold-text underline">
            {t("clearOwnerFilter")}
          </Link>
        </p>
      )}
      <ServerDataTable
        columns={columns}
        rows={shops.data?.rows}
        total={shops.data?.total ?? 0}
        loading={shops.isFetching}
        state={table}
        onStateChange={setTable}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/backoffice/shops/${r.id}`)}
        empty={<EmptyState icon={Store} title={t("empty")} />}
      />
    </>
  );
}
