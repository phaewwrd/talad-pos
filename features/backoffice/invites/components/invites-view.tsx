"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Mail, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import {
  type ServerColumn,
  ServerDataTable,
  tableQuery,
} from "@/components/data-table/server-data-table";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Link } from "@/i18n/navigation";
import { getJson } from "@/lib/api/client";
import {
  INVITE_STATUSES,
  type InviteStatus,
} from "@/lib/backoffice/invite-status";
import { useDateTime } from "@/lib/format";
import { useCan } from "../../components/backoffice-context";
import { EntitlementSummary } from "../../components/entitlement-summary";
import {
  DateRangeFilter,
  ListToolbar,
  SearchFilter,
  SelectFilter,
  useTableState,
} from "../../components/list-toolbar";
import { InviteStatusChip } from "../../components/status-chip";
import type { InviteDTO } from "../queries";
import { DeliveryLogSheet } from "./delivery-log-sheet";
import { InviteFormSheet } from "./invite-form-sheet";
import { InviteRowActions } from "./invite-row-actions";
import { LinkDialog } from "./link-dialog";

type UserOption = { id: string; name: string; email: string };

export function InvitesView() {
  const t = useTranslations("backoffice.invites");
  const ts = useTranslations("backoffice.inviteStatus");
  const { dateTime, date } = useDateTime();
  const can = useCan();

  const [table, setTable] = useTableState("createdAt");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<InviteStatus | "">("");
  const [createdBy, setCreatedBy] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const search = useDebouncedValue(q.trim());

  const [form, setForm] = useState<{ invite?: InviteDTO } | null>(null);
  const [logFor, setLogFor] = useState<InviteDTO | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const params = {
    ...tableQuery(table),
    q: search,
    status,
    createdBy,
    from: range.from,
    to: range.to,
  };
  const invites = useQuery({
    queryKey: ["backoffice", "invites", params],
    queryFn: () =>
      getJson<{ rows: InviteDTO[]; total: number }>(
        "/api/backoffice/invites",
        params,
      ),
    placeholderData: keepPreviousData,
  });
  const users = useQuery({
    queryKey: ["backoffice", "users"],
    queryFn: () => getJson<UserOption[]>("/api/backoffice/users"),
    staleTime: 5 * 60_000,
  });

  const resetPage = () =>
    setTable((s) => ({ ...s, pagination: { ...s.pagination, pageIndex: 0 } }));

  const columns = useMemo<ServerColumn<InviteDTO>[]>(
    () => [
      {
        id: "label",
        accessorKey: "label",
        header: t("label"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.label}</span>
        ),
      },
      {
        id: "email",
        accessorKey: "email",
        header: t("recipient"),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.email ?? (
              <span className="text-muted-foreground">—</span>
            )}
            {row.original.email && row.original.lockToEmail && (
              <span className="ml-1 text-muted-foreground text-xs">
                ({t("locked")})
              </span>
            )}
          </span>
        ),
      },
      {
        id: "status",
        header: t("status"),
        enableSorting: false,
        cell: ({ row }) => <InviteStatusChip status={row.original.status} />,
      },
      {
        id: "plan",
        header: t("plan"),
        enableSorting: false,
        cell: ({ row }) => (
          <EntitlementSummary
            limits={row.original.limits}
            features={row.original.features}
          />
        ),
      },
      {
        id: "sendCount",
        accessorKey: "sendCount",
        header: t("sendCount"),
        meta: { align: "right" },
      },
      {
        id: "sentAt",
        accessorKey: "sentAt",
        header: t("lastSent"),
        cell: ({ row }) =>
          row.original.sentAt ? (
            <span className="whitespace-nowrap text-xs">
              {dateTime(row.original.sentAt)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "expiresAt",
        accessorKey: "expiresAt",
        header: t("expires"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">
            {dateTime(row.original.expiresAt)}
          </span>
        ),
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: t("createdBy"),
        cell: ({ row }) => (
          <span className="grid text-xs">
            <span>{row.original.createdByName ?? "—"}</span>
            <span className="text-muted-foreground">
              {date(row.original.createdAt)}
            </span>
          </span>
        ),
      },
      {
        id: "usedBy",
        header: t("usedBy"),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.usedById ? (
            <Link
              href={`/backoffice/owners?q=${encodeURIComponent(row.original.usedByEmail ?? "")}`}
              className="text-gold-text text-xs hover:underline"
            >
              {row.original.usedByEmail}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <InviteRowActions
            invite={row.original}
            onEdit={() => setForm({ invite: row.original })}
            onDeliveryLog={() => setLogFor(row.original)}
            onLink={setLink}
          />
        ),
      },
    ],
    [t, dateTime, date],
  );

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          can("invite.create") && (
            <Button className="h-11 rounded-full" onClick={() => setForm({})}>
              <Plus className="size-4" /> {t("create")}
            </Button>
          )
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
          options={INVITE_STATUSES.map((s) => ({ value: s, label: ts(s) }))}
        />
        <SelectFilter
          label={t("createdBy")}
          value={createdBy}
          onChange={(v) => {
            setCreatedBy(v);
            resetPage();
          }}
          options={(users.data ?? []).map((u) => ({
            value: u.id,
            label: u.name,
          }))}
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
      </ListToolbar>
      <ServerDataTable
        columns={columns}
        rows={invites.data?.rows}
        total={invites.data?.total ?? 0}
        loading={invites.isFetching}
        state={table}
        onStateChange={setTable}
        getRowId={(r) => r.id}
        empty={
          <EmptyState
            icon={Mail}
            title={t("empty")}
            description={t("emptyDescription")}
          />
        }
      />
      {form && (
        <InviteFormSheet
          invite={form.invite}
          onClose={() => setForm(null)}
          onLink={setLink}
        />
      )}
      {logFor && (
        <DeliveryLogSheet invite={logFor} onClose={() => setLogFor(null)} />
      )}
      {link && <LinkDialog url={link} onClose={() => setLink(null)} />}
    </>
  );
}
