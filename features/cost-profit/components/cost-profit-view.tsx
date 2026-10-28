"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { type DataColumn, DataTable } from "@/components/data-table/data-table";
import { useAppForm } from "@/components/form/app-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProducts } from "@/features/catalog/hooks";
import { type ApiError, getJson, unwrap } from "@/lib/api/client";
import { suggestPrice } from "@/lib/cost-profit";
import { useMoney } from "@/lib/format";
import { money as dec, sumMoney, toMoneyString } from "@/lib/money";
import type { RangePreset } from "@/lib/sales/range";
import { bangkokDateString } from "@/lib/time";
import { useErrorMessage } from "@/lib/use-error-message";
import { cn } from "@/lib/utils";
import { createEntry, deleteEntry, updateEntry } from "../actions";
import type { EntryDTO, RealProfitDTO } from "../queries";
import { COST_PROFIT_CHANNELS, entrySchema } from "../schemas";

const PRESETS: RangePreset[] = ["today", "7d", "month"];

export function CostProfitView({ orgId }: { orgId: string }) {
  const t = useTranslations("costProfit");
  const ts = useTranslations("sales.preset");
  const [preset, setPreset] = useState<RangePreset>("month");

  return (
    <Tabs defaultValue="orders">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TabsList className="h-11 rounded-full p-1">
          <TabsTrigger value="orders" className="rounded-full px-4">
            {t("tabOrders")}
          </TabsTrigger>
          <TabsTrigger value="entries" className="rounded-full px-4">
            {t("tabEntries")}
          </TabsTrigger>
          <TabsTrigger value="calculator" className="rounded-full px-4">
            {t("tabCalculator")}
          </TabsTrigger>
        </TabsList>
        <fieldset
          className="ml-auto flex gap-1 rounded-full border bg-card p-1"
          aria-label={t("range")}
        >
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={preset === p}
              onClick={() => setPreset(p)}
              className={cn(
                "h-9 rounded-full px-4 text-sm",
                preset === p
                  ? "bg-foreground text-background"
                  : "text-muted-foreground",
              )}
            >
              {ts(p)}
            </button>
          ))}
        </fieldset>
      </div>
      <TabsContent value="orders">
        <RealOrders orgId={orgId} preset={preset} />
      </TabsContent>
      <TabsContent value="entries">
        <PlatformEntries orgId={orgId} preset={preset} />
      </TabsContent>
      <TabsContent value="calculator">
        <PriceCalculator />
      </TabsContent>
    </Tabs>
  );
}

function RealOrders({ orgId, preset }: { orgId: string; preset: RangePreset }) {
  const t = useTranslations("costProfit");
  const tc = useTranslations("channels");
  const money = useMoney();
  const q = useQuery({
    queryKey: ["cost-profit", orgId, preset],
    queryFn: () => getJson<RealProfitDTO[]>("/api/cost-profit", { preset }),
  });
  const columns = useMemo<DataColumn<RealProfitDTO>[]>(
    () => [
      { id: "product", accessorFn: (r) => r.productName, header: t("product") },
      {
        id: "channel",
        accessorFn: (r) => r.channel,
        header: t("channel"),
        cell: ({ row }) => tc(row.original.channel),
      },
      {
        id: "qty",
        accessorFn: (r) => r.quantity,
        header: t("qty"),
        meta: { align: "right" },
      },
      {
        id: "revenue",
        accessorFn: (r) => Number(r.revenue),
        header: t("revenue"),
        meta: { align: "right" },
        cell: ({ row }) => money(row.original.revenue),
      },
      {
        id: "cogs",
        accessorFn: (r) => Number(r.cogs),
        header: t("cogs"),
        meta: { align: "right" },
        cell: ({ row }) => money(row.original.cogs),
      },
      {
        id: "profit",
        accessorFn: (r) => Number(r.grossProfit),
        header: t("grossProfit"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <span
            className={cn(
              "font-semibold",
              Number(row.original.grossProfit) < 0 && "text-primary",
            )}
          >
            {money(row.original.grossProfit)}
          </span>
        ),
      },
      {
        id: "margin",
        accessorFn: (r) => Number(r.marginPercent),
        header: t("margin"),
        meta: { align: "right" },
        cell: ({ row }) => `${row.original.marginPercent}%`,
      },
    ],
    [t, tc, money],
  );
  const totals = q.data && {
    revenue: toMoneyString(sumMoney(q.data.map((r) => r.revenue))),
    cogs: toMoneyString(sumMoney(q.data.map((r) => r.cogs))),
  };
  return (
    <div className="grid gap-3">
      {totals && (
        <div className="grid grid-cols-3 gap-3">
          <Total label={t("revenue")} value={money(totals.revenue)} />
          <Total label={t("cogs")} value={money(totals.cogs)} />
          <Total
            label={t("grossProfit")}
            value={money(toMoneyString(dec(totals.revenue).minus(totals.cogs)))}
            strong
          />
        </div>
      )}
      <p className="text-muted-foreground text-xs">{t("ordersHint")}</p>
      <DataTable
        columns={columns}
        data={q.data}
        loading={q.isPending}
        empty={<EmptyState title={t("noOrders")} />}
      />
    </div>
  );
}

function Total({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-card">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "font-semibold text-lg tabular-nums",
          strong && "text-gold-text",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PlatformEntries({
  orgId,
  preset,
}: {
  orgId: string;
  preset: RangePreset;
}) {
  const t = useTranslations("costProfit");
  const tc = useTranslations("channels");
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EntryDTO | null | undefined>(
    undefined,
  );
  const key = ["cost-profit", orgId, "entries", preset];
  const q = useQuery({
    queryKey: key,
    queryFn: () => getJson<EntryDTO[]>("/api/cost-profit/entries", { preset }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await deleteEntry(id)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["cost-profit", orgId] }),
    onError: (err: ApiError) => toast.error(errorMessage(err.code)),
  });

  const summary = COST_PROFIT_CHANNELS.map((c) => {
    const rows = (q.data ?? []).filter((e) => e.salesChannel === c);
    return {
      channel: c,
      revenue: toMoneyString(sumMoney(rows.map((r) => r.revenue))),
      fee: toMoneyString(sumMoney(rows.map((r) => r.fee))),
      net: toMoneyString(sumMoney(rows.map((r) => r.netProfit))),
    };
  });

  const columns = useMemo<DataColumn<EntryDTO>[]>(
    () => [
      { id: "date", accessorFn: (e) => e.entryDate, header: t("date") },
      {
        id: "channel",
        accessorFn: (e) => e.salesChannel,
        header: t("channel"),
        cell: ({ row }) => tc(row.original.salesChannel),
      },
      { id: "product", accessorFn: (e) => e.productName, header: t("product") },
      {
        id: "qty",
        accessorFn: (e) => e.quantity,
        header: t("qty"),
        meta: { align: "right" },
      },
      {
        id: "revenue",
        accessorFn: (e) => Number(e.revenue),
        header: t("revenue"),
        meta: { align: "right" },
        cell: ({ row }) => money(row.original.revenue),
      },
      {
        id: "fee",
        accessorFn: (e) => Number(e.fee),
        header: t("fee"),
        meta: { align: "right" },
        cell: ({ row }) =>
          `${money(row.original.fee)} (${Number(row.original.platformFeeRate)}%)`,
      },
      {
        id: "cost",
        accessorFn: (e) => Number(e.cost),
        header: t("cost"),
        meta: { align: "right" },
        cell: ({ row }) => money(row.original.cost),
      },
      {
        id: "net",
        accessorFn: (e) => Number(e.netProfit),
        header: t("netProfit"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <span
            className={cn(
              "font-semibold",
              Number(row.original.netProfit) < 0 && "text-primary",
            )}
          >
            {money(row.original.netProfit)}
          </span>
        ),
      },
      {
        id: "margin",
        accessorFn: (e) => Number(e.marginPercent),
        header: t("margin"),
        meta: { align: "right" },
        cell: ({ row }) => `${row.original.marginPercent}%`,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full"
              aria-label={t("edit")}
              onClick={() => setEditing(row.original)}
            >
              <Pencil className="size-4" />
            </Button>
            <ConfirmDialog
              title={t("deleteTitle")}
              confirmLabel={t("delete")}
              destructive
              onConfirm={() => remove.mutate(row.original.id)}
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full text-destructive"
                aria-label={t("delete")}
              >
                <Trash2 className="size-4" />
              </Button>
            </ConfirmDialog>
          </div>
        ),
      },
    ],
    [t, tc, money, remove],
  );

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {summary.map((s) => (
          <div
            key={s.channel}
            className="rounded-2xl border bg-card p-3 shadow-card"
          >
            <p className="font-medium">{tc(s.channel)}</p>
            <p className="mt-1 text-muted-foreground text-xs">
              {t("revenue")} {money(s.revenue)} · {t("fee")} {money(s.fee)}
            </p>
            <p className="font-semibold text-gold-text text-lg tabular-nums">
              {money(s.net)}
            </p>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button className="h-11 rounded-full" onClick={() => setEditing(null)}>
          <Plus className="size-4" /> {t("addEntry")}
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={q.data}
        loading={q.isPending}
        empty={<EmptyState title={t("noEntries")} />}
      />
      {editing !== undefined && (
        <EntrySheet
          orgId={orgId}
          entry={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}

function EntrySheet({
  orgId,
  entry,
  onClose,
}: {
  orgId: string;
  entry: EntryDTO | null;
  onClose: () => void;
}) {
  const t = useTranslations("costProfit");
  const tc = useTranslations("channels");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const products = useProducts(orgId);
  const save = useMutation({
    mutationFn: async (v: unknown) =>
      unwrap(entry ? await updateEntry(entry.id, v) : await createEntry(v)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-profit", orgId] });
      toast.success(t("saved"));
      onClose();
    },
    onError: (err: ApiError) => toast.error(errorMessage(err.code)),
  });
  const form = useAppForm({
    defaultValues: {
      entryDate: entry?.entryDate ?? bangkokDateString(new Date()),
      salesChannel: entry?.salesChannel ?? "shopee",
      productId: entry?.productId ?? "",
      productName: entry?.productName ?? "",
      quantity: String(entry?.quantity ?? 1),
      unitCost: entry?.unitCost ?? "",
      unitPrice: entry?.unitPrice ?? "",
      platformFeeRate: entry ? String(Number(entry.platformFeeRate)) : "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const r = entrySchema.safeParse(value);
        return r.success
          ? undefined
          : {
              fields: Object.fromEntries(
                r.error.issues.map((i) => [
                  String(i.path[0]),
                  { message: i.message },
                ]),
              ),
            };
      },
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value).catch(() => {});
    },
  });
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{entry ? t("edit") : t("addEntry")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("addEntry")}
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="grid gap-4 px-4 pb-6"
        >
          <div className="grid grid-cols-2 gap-3">
            <form.AppField name="entryDate">
              {(f) => <f.TextField label={t("date")} type="date" />}
            </form.AppField>
            <form.AppField name="salesChannel">
              {(f) => (
                <f.SelectField
                  label={t("channel")}
                  options={COST_PROFIT_CHANNELS.map((c) => ({
                    value: c,
                    label: tc(c),
                  }))}
                />
              )}
            </form.AppField>
          </div>
          <form.Field name="productId">
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor="entry-product">{t("linkProduct")}</Label>
                <select
                  id="entry-product"
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    const p = products.data?.find(
                      (x) => x.id === e.target.value,
                    );
                    if (p) {
                      form.setFieldValue("productName", p.name);
                      if (p.cost) form.setFieldValue("unitCost", p.cost);
                    }
                  }}
                  className="h-11 rounded-xl border bg-card px-3 text-sm"
                >
                  <option value="">{t("noLink")}</option>
                  {(products.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </form.Field>
          <form.AppField name="productName">
            {(f) => <f.TextField label={t("product")} />}
          </form.AppField>
          <div className="grid grid-cols-2 gap-3">
            <form.AppField name="quantity">
              {(f) => <f.TextField label={t("qty")} inputMode="numeric" />}
            </form.AppField>
            <form.AppField name="platformFeeRate">
              {(f) => (
                <f.TextField label={t("feePercent")} inputMode="decimal" />
              )}
            </form.AppField>
            <form.AppField name="unitCost">
              {(f) => <f.TextField label={t("unitCost")} inputMode="decimal" />}
            </form.AppField>
            <form.AppField name="unitPrice">
              {(f) => (
                <f.TextField label={t("unitPrice")} inputMode="decimal" />
              )}
            </form.AppField>
          </div>
          <form.AppForm>
            <form.SubmitButton>{t("save")}</form.SubmitButton>
          </form.AppForm>
        </form>
      </SheetContent>
    </Sheet>
  );
}

const CALC_CHANNELS = ["storefront", "shopee", "lineman", "grab"] as const;
const DEFAULT_FEES: Record<(typeof CALC_CHANNELS)[number], string> = {
  storefront: "0",
  shopee: "15",
  lineman: "30",
  grab: "30",
};
const NUM = /^\d{0,10}(\.\d{0,2})?$/;

function PriceCalculator() {
  const t = useTranslations("costProfit");
  const tc = useTranslations("channels");
  const money = useMoney();
  const [cost, setCost] = useState("30");
  const [margin, setMargin] = useState("30");
  const [fees, setFees] = useState(DEFAULT_FEES);
  const valid = (v: string) => v !== "" && NUM.test(v);

  return (
    <div className="grid gap-4">
      <div className="grid max-w-md grid-cols-2 gap-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="grid gap-1.5">
          <Label htmlFor="calc-cost">{t("unitCost")}</Label>
          <Input
            id="calc-cost"
            inputMode="decimal"
            value={cost}
            onChange={(e) =>
              NUM.test(e.target.value) && setCost(e.target.value)
            }
            className="h-11 rounded-xl"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="calc-margin">{t("targetMargin")}</Label>
          <Input
            id="calc-margin"
            inputMode="decimal"
            value={margin}
            onChange={(e) =>
              NUM.test(e.target.value) && setMargin(e.target.value)
            }
            className="h-11 rounded-xl"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CALC_CHANNELS.map((c) => {
          const result =
            valid(cost) && valid(margin) && valid(fees[c])
              ? suggestPrice({
                  cost,
                  feePercent: fees[c],
                  targetMarginPercent: margin,
                })
              : null;
          return (
            <div
              key={c}
              className="grid gap-3 rounded-2xl border bg-card p-4 shadow-card"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{tc(c)}</p>
                <div className="flex items-center gap-1">
                  <Input
                    aria-label={t("feeFor", { channel: tc(c) })}
                    inputMode="decimal"
                    value={fees[c]}
                    onChange={(e) =>
                      NUM.test(e.target.value) &&
                      setFees((f) => ({ ...f, [c]: e.target.value }))
                    }
                    className="h-9 w-20 rounded-lg text-right"
                  />
                  <span className="text-muted-foreground text-sm">%</span>
                </div>
              </div>
              {result ? (
                <>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t("suggestedPrice")}
                    </p>
                    <p className="font-bold text-2xl text-gold-text tabular-nums">
                      {money(result.price)}
                    </p>
                  </div>
                  <div className="grid gap-0.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("fee")}</span>
                      <span className="tabular-nums">{money(result.fee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("profitPerUnit")}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {money(result.profitPerUnit)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-primary text-sm">{t("impossible")}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
