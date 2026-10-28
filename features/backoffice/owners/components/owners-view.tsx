"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Link } from "@/i18n/navigation";
import { getJson } from "@/lib/api/client";
import { useDateTime } from "@/lib/format";
import { EntitlementSummary } from "../../components/entitlement-summary";
import {
  ListToolbar,
  SearchFilter,
  SelectFilter,
  useTableState,
} from "../../components/list-toolbar";
import { BannedChip } from "../../components/status-chip";
import type { OwnerDTO } from "../queries";
import { OwnerRowActions } from "./owner-row-actions";

export function OwnersView() {
  const t = useTranslations("backoffice.owners");
  const { date, dateTime } = useDateTime();
  const searchParams = useSearchParams();
  const [table, setTable] = useTableState("createdAt");
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [banned, setBanned] = useState<"true" | "false" | "">("");
  const search = useDebouncedValue(q.trim());

  const params = { ...tableQuery(table), q: search, banned };
  const owners = useQuery({
    queryKey: ["backoffice", "owners", params],
    queryFn: () =>
      getJson<{ rows: OwnerDTO[]; total: number }>(
        "/api/backoffice/owners",
        params,
      ),
    placeholderData: keepPreviousData,
  });
  const resetPage = () =>
    setTable((s) => ({ ...s, pagination: { ...s.pagination, pageIndex: 0 } }));

  const columns = useMemo<ServerColumn<OwnerDTO>[]>(
    () => [
      {
        id: "email",
        accessorKey: "email",
        header: t("email"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.email}</span>
        ),
      },
      { id: "name", accessorKey: "name", header: t("name") },
      {
        id: "shops",
        accessorKey: "shops",
        header: t("shops"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <Link
            href={`/backoffice/shops?ownerId=${row.original.id}`}
            className="text-gold-text hover:underline"
          >
            {row.original.shops}
          </Link>
        ),
      },
      {
        id: "plan",
        header: t("plan"),
        enableSorting: false,
        cell: ({ row }) => (
          <EntitlementSummary
            limits={row.original.entitlements.limits}
            features={row.original.entitlements.features}
          />
        ),
      },
      {
        id: "banned",
        header: t("status"),
        enableSorting: false,
        cell: ({ row }) => (
          <span title={row.original.banReason ?? undefined}>
            <BannedChip banned={row.original.banned} />
          </span>
        ),
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: t("created"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">
            {date(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "lastLoginAt",
        accessorKey: "lastLoginAt",
        header: t("lastLogin"),
        cell: ({ row }) =>
          row.original.lastLoginAt ? (
            <span className="whitespace-nowrap text-xs">
              {dateTime(row.original.lastLoginAt)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => <OwnerRowActions owner={row.original} />,
      },
    ],
    [t, date, dateTime],
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
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
          value={banned}
          onChange={(v) => {
            setBanned(v);
            resetPage();
          }}
          options={[
            { value: "false", label: t("active") },
            { value: "true", label: t("banned") },
          ]}
        />
      </ListToolbar>
      <ServerDataTable
        columns={columns}
        rows={owners.data?.rows}
        total={owners.data?.total ?? 0}
        loading={owners.isFetching}
        state={table}
        onStateChange={setTable}
        getRowId={(r) => r.id}
        empty={<EmptyState icon={UserRound} title={t("empty")} />}
      />
    </>
  );
}
