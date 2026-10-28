"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { type DataColumn, DataTable } from "@/components/data-table/data-table";
import { useAppForm } from "@/components/form/app-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getJson } from "@/lib/api/client";
import { useDateTime } from "@/lib/format";
import { useErrorMessage } from "@/lib/use-error-message";
import { cn } from "@/lib/utils";
import { createInvite, revokeInvite } from "../actions";
import type { AdminShopDTO, InviteDTO } from "../queries";
import { createInviteSchema } from "../schemas";

const FEATURE_KEYS = [
  "promotions",
  "costProfit",
  "export",
  "platformChannels",
  "multiShop",
] as const;
const STATUS_STYLE: Record<InviteDTO["status"], string> = {
  active: "bg-success/15 text-success",
  used: "bg-muted text-muted-foreground",
  expired: "bg-warning/15 text-[#9a6608]",
  revoked: "border border-primary text-primary bg-transparent",
};

export function InvitesView() {
  const t = useTranslations("admin");
  const { dateTime } = useDateTime();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const invites = useQuery({
    queryKey: ["admin", "invites"],
    queryFn: () => getJson<InviteDTO[]>("/api/admin/invites"),
  });
  const [creating, setCreating] = useState(false);

  const columns = useMemo<DataColumn<InviteDTO>[]>(
    () => [
      {
        id: "label",
        accessorFn: (i) => i.label,
        header: t("label"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.label}</p>
            {row.original.email && (
              <p className="text-muted-foreground text-xs">
                {row.original.email}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "status",
        accessorFn: (i) => i.status,
        header: t("status"),
        cell: ({ row }) => (
          <span
            className={cn(
              "inline-flex h-6 items-center rounded-full px-2.5 text-xs",
              STATUS_STYLE[row.original.status],
            )}
          >
            {t(`inviteStatus.${row.original.status}`)}
          </span>
        ),
      },
      {
        id: "limits",
        header: t("limits"),
        enableSorting: false,
        cell: ({ row }) => {
          const l = row.original.limits;
          return (
            <span className="whitespace-nowrap text-xs tabular-nums">
              {t("limitsShort", {
                shops: l.maxShops,
                staff: l.maxStaffPerShop,
                products: l.maxProducts,
              })}
            </span>
          );
        },
      },
      {
        id: "features",
        header: t("features"),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {FEATURE_KEYS.filter((k) => row.original.features[k]).map((k) => (
              <Badge
                key={k}
                variant="secondary"
                className="rounded-full text-[11px]"
              >
                {t(`feature.${k}`)}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "expires",
        accessorFn: (i) => i.expiresAt,
        header: t("expires"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {dateTime(row.original.expiresAt)}
          </span>
        ),
      },
      {
        id: "usedBy",
        accessorFn: (i) => i.usedByEmail ?? "",
        header: t("usedBy"),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.status === "active" ? (
            <ConfirmDialog
              title={t("revokeTitle", { label: row.original.label })}
              confirmLabel={t("revoke")}
              destructive
              onConfirm={async () => {
                const r = await revokeInvite(row.original.id);
                if (!r.ok) return void toast.error(errorMessage(r.code));
                queryClient.invalidateQueries({
                  queryKey: ["admin", "invites"],
                });
              }}
            >
              <Button
                variant="outline"
                className="h-9 rounded-full text-destructive"
              >
                {t("revoke")}
              </Button>
            </ConfirmDialog>
          ) : null,
      },
    ],
    [t, dateTime, errorMessage, queryClient],
  );

  return (
    <>
      <PageHeader
        title={t("invites")}
        description={t("invitesDescription")}
        actions={
          <Button
            className="h-11 rounded-full"
            onClick={() => setCreating(true)}
          >
            <Plus className="size-4" /> {t("createInvite")}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={invites.data}
        loading={invites.isPending}
        empty={<EmptyState icon={Link2} title={t("noInvites")} />}
      />
      {creating && <CreateInviteDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateInviteDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useAppForm({
    defaultValues: {
      label: "",
      email: "",
      expiresInDays: "14",
      limits: { maxShops: "1", maxStaffPerShop: "5", maxProducts: "200" },
      features: {
        promotions: true,
        costProfit: true,
        export: true,
        platformChannels: true,
        multiShop: false,
      },
    },
    validators: {
      onSubmit: ({ value }) => {
        const r = createInviteSchema.safeParse(value);
        return r.success
          ? undefined
          : {
              fields: Object.fromEntries(
                r.error.issues.map((i) => [
                  i.path.join("."),
                  { message: i.message },
                ]),
              ),
            };
      },
    },
    onSubmit: async ({ value }) => {
      const r = await createInvite(value);
      if (!r.ok) return void toast.error(errorMessage(r.code));
      setLink(
        `${window.location.origin}/${locale}/signup?token=${r.data.token}`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "invites"] });
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createInvite")}</DialogTitle>
          <DialogDescription>
            {link ? t("linkOnce") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="grid gap-3">
            <Input
              readOnly
              value={link}
              className="h-11 rounded-xl font-mono text-xs"
              onFocus={(e) => e.target.select()}
            />
            <Button
              className="h-12 rounded-full"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}{" "}
              {copied ? t("copied") : t("copy")}
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-full"
              onClick={onClose}
            >
              {t("done")}
            </Button>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="grid gap-4"
          >
            <form.AppField name="label">
              {(f) => (
                <f.TextField
                  label={t("label")}
                  placeholder={t("labelPlaceholder")}
                />
              )}
            </form.AppField>
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="email">
                {(f) => (
                  <f.TextField
                    label={t("emailLock")}
                    type="email"
                    hint={t("optional")}
                  />
                )}
              </form.AppField>
              <form.AppField name="expiresInDays">
                {(f) => (
                  <f.TextField label={t("expiresInDays")} inputMode="numeric" />
                )}
              </form.AppField>
            </div>
            <fieldset className="grid grid-cols-3 gap-3">
              <legend className="mb-1.5 font-medium text-sm">
                {t("limits")}
              </legend>
              <form.AppField name="limits.maxShops">
                {(f) => (
                  <f.TextField label={t("maxShops")} inputMode="numeric" />
                )}
              </form.AppField>
              <form.AppField name="limits.maxStaffPerShop">
                {(f) => (
                  <f.TextField label={t("maxStaff")} inputMode="numeric" />
                )}
              </form.AppField>
              <form.AppField name="limits.maxProducts">
                {(f) => (
                  <f.TextField label={t("maxProducts")} inputMode="numeric" />
                )}
              </form.AppField>
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 font-medium text-sm">
                {t("features")}
              </legend>
              {FEATURE_KEYS.map((k) => (
                <form.Field key={k} name={`features.${k}`}>
                  {(field) => (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`feature-${k}`}
                        checked={field.state.value}
                        onCheckedChange={(v) => field.handleChange(v === true)}
                      />
                      <Label htmlFor={`feature-${k}`} className="font-normal">
                        {t(`feature.${k}`)}
                      </Label>
                    </div>
                  )}
                </form.Field>
              ))}
            </fieldset>
            <form.AppForm>
              <form.SubmitButton>{t("createInvite")}</form.SubmitButton>
            </form.AppForm>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AdminShopsView() {
  const t = useTranslations("admin");
  const { date } = useDateTime();
  const shops = useQuery({
    queryKey: ["admin", "shops"],
    queryFn: () => getJson<AdminShopDTO[]>("/api/admin/shops"),
  });
  const columns = useMemo<DataColumn<AdminShopDTO>[]>(
    () => [
      {
        id: "name",
        accessorFn: (s) => s.name,
        header: t("shop"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "owner",
        accessorFn: (s) => s.ownerEmail ?? "",
        header: t("owner"),
        cell: ({ row }) => (
          <div>
            <p>{row.original.ownerName}</p>
            <p className="text-muted-foreground text-xs">
              {row.original.ownerEmail}
            </p>
          </div>
        ),
      },
      {
        id: "limits",
        header: t("limits"),
        enableSorting: false,
        cell: ({ row }) => {
          const l = row.original.entitlements.limits;
          return (
            <span className="whitespace-nowrap text-xs tabular-nums">
              {t("limitsShort", {
                shops: l.maxShops,
                staff: l.maxStaffPerShop,
                products: l.maxProducts,
              })}
            </span>
          );
        },
      },
      {
        id: "usage",
        header: t("usage"),
        enableSorting: false,
        cell: ({ row }) => {
          const u = row.original.usage;
          return (
            <span className="whitespace-nowrap text-xs tabular-nums">
              {t("usageShort", {
                products: u.products,
                staff: u.staff,
                orders: u.orders,
              })}
            </span>
          );
        },
      },
      {
        id: "created",
        accessorFn: (s) => s.createdAt,
        header: t("created"),
        cell: ({ row }) => date(row.original.createdAt),
      },
    ],
    [t, date],
  );
  return (
    <>
      <PageHeader title={t("shops")} />
      <DataTable
        columns={columns}
        data={shops.data}
        loading={shops.isPending}
        empty={<EmptyState title={t("noShops")} />}
      />
    </>
  );
}
