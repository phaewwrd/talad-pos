"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Coins,
  Download,
  Percent,
  ReceiptText,
  ShoppingBasket,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson } from "@/lib/api/client";
import { useMoney } from "@/lib/format";
import { money as dec } from "@/lib/money";
import type { MemberRole } from "@/lib/roles";
import type { Grouping, RangePreset } from "@/lib/sales/range";
import { bangkokDateString } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { SalesReport } from "../queries";

type AllShops = {
  shops: { id: string; name: string; revenue: string; orders: number }[];
  total: string;
};

const PRESETS: RangePreset[] = ["today", "7d", "month", "custom"];

export function SalesView({
  orgId,
  role,
  canExport,
  shopCount,
}: {
  orgId: string;
  role: MemberRole;
  canExport: boolean;
  shopCount: number;
}) {
  const t = useTranslations("sales");
  const money = useMoney();
  const today = bangkokDateString(new Date());
  const [preset, setPreset] = useState<RangePreset>(
    role === "cashier" ? "today" : "7d",
  );
  const [custom, setCustom] = useState({ from: today, to: today });
  const [group, setGroup] = useState<Grouping>("day");
  const params = {
    preset,
    group,
    ...(preset === "custom" ? custom : {}),
  };
  const report = useQuery({
    queryKey: ["sales", orgId, params],
    queryFn: () => getJson<SalesReport>("/api/sales", params),
    placeholderData: keepPreviousData,
  });
  const allShops = useQuery({
    queryKey: ["sales", orgId, "all-shops", params],
    queryFn: () => getJson<AllShops>("/api/sales/all-shops", params),
    enabled: role === "owner" && shopCount > 1,
  });
  const data = report.data;
  const loading = report.isPending;
  const isCashier = role === "cashier";
  const exportUrl = (format: "csv" | "xlsx") =>
    `/api/sales/export?${new URLSearchParams({ ...params, format } as Record<string, string>)}`;

  return (
    <div className="grid gap-4">
      {isCashier ? (
        <p className="rounded-2xl bg-gold-soft p-3 text-gold-text text-sm">
          {t("cashierScope")}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <fieldset
            className="flex flex-wrap gap-1 rounded-full border bg-card p-1"
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
                {t(`preset.${p}`)}
              </button>
            ))}
          </fieldset>
          {preset === "custom" && (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                aria-label={t("from")}
                value={custom.from}
                max={custom.to}
                onChange={(e) =>
                  setCustom((c) => ({ ...c, from: e.target.value }))
                }
                className="h-10 w-40 rounded-xl"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                aria-label={t("to")}
                value={custom.to}
                min={custom.from}
                onChange={(e) =>
                  setCustom((c) => ({ ...c, to: e.target.value }))
                }
                className="h-10 w-40 rounded-xl"
              />
            </div>
          )}
          <Select value={group} onValueChange={(v) => setGroup(v as Grouping)}>
            <SelectTrigger
              className="h-10 w-32 rounded-full"
              aria-label={t("groupBy")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["day", "week", "month"] as const).map((g) => (
                <SelectItem key={g} value={g}>
                  {t(`group.${g}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-2">
            {(["csv", "xlsx"] as const).map((f) => (
              <Button
                key={f}
                asChild={canExport}
                variant="outline"
                className="h-10 rounded-full"
                disabled={!canExport}
                title={canExport ? undefined : t("exportLocked")}
              >
                {canExport ? (
                  <a href={exportUrl(f)} download>
                    <Download className="size-4" /> {f.toUpperCase()}
                  </a>
                ) : (
                  <span>
                    <Download className="size-4" /> {f.toUpperCase()}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-2 gap-3 md:grid-cols-3",
          data?.profit ? "xl:grid-cols-6" : "xl:grid-cols-4",
        )}
      >
        <StatCard
          label={t("revenue")}
          value={money(data?.kpis.revenue)}
          icon={Banknote}
          tone="gold"
          loading={loading}
          hint={
            data && (
              <Change
                current={data.kpis.revenue}
                previous={data.kpis.previousRevenue}
              />
            )
          }
        />
        <StatCard
          label={t("orders")}
          value={data?.kpis.orders ?? 0}
          icon={ReceiptText}
          loading={loading}
          hint={
            data && (
              <Change
                current={String(data.kpis.orders)}
                previous={String(data.kpis.previousOrders)}
              />
            )
          }
        />
        <StatCard
          label={t("aov")}
          value={money(data?.kpis.averageOrderValue)}
          icon={ShoppingBasket}
          loading={loading}
        />
        <StatCard
          label={t("discounts")}
          value={money(data?.kpis.discounts)}
          icon={Percent}
          loading={loading}
        />
        {data?.profit && (
          <>
            <StatCard
              label={t("cogs")}
              value={money(data.profit.cogs)}
              icon={Coins}
              loading={loading}
            />
            <StatCard
              label={t("grossProfit")}
              value={money(data.profit.grossProfit)}
              icon={TrendingUp}
              tone="success"
              loading={loading}
              hint={t("grossProfitHint")}
            />
          </>
        )}
      </div>

      <section
        className="rounded-2xl border bg-card p-4 shadow-card"
        aria-labelledby="revenue-chart"
      >
        <h2 id="revenue-chart" className="mb-2 font-semibold">
          {t("revenueOverTime")}
        </h2>
        {loading || !data ? (
          <Skeleton className="h-72 rounded-xl" />
        ) : (
          <RevenueChart data={data} />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown
          title={t("byChannel")}
          rows={data?.breakdowns.channel}
          labelKey="channels"
          loading={loading}
        />
        <Breakdown
          title={t("byPayment")}
          rows={data?.breakdowns.paymentMethod}
          labelKey="methods"
          loading={loading}
        />
        <Breakdown
          title={t("byStaff")}
          rows={data?.breakdowns.staff}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopList
          title={t("topProducts")}
          rows={data?.topProducts}
          loading={loading}
        />
        <TopList
          title={t("topCategories")}
          rows={data?.topCategories}
          loading={loading}
        />
      </div>

      {role === "owner" && shopCount > 1 && (
        <section
          className="rounded-2xl border bg-card p-4 shadow-card"
          aria-labelledby="all-shops"
        >
          <h2 id="all-shops" className="mb-3 font-semibold">
            {t("allShops")}
          </h2>
          {allShops.data ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground text-xs">
                  <th className="py-2 font-normal">{t("shop")}</th>
                  <th className="py-2 text-right font-normal">{t("orders")}</th>
                  <th className="py-2 text-right font-normal">
                    {t("revenue")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {allShops.data.shops.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2 text-right tabular-nums">{s.orders}</td>
                    <td className="py-2 text-right tabular-nums">
                      {money(s.revenue)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t font-semibold">
                  <td className="py-2">{t("total")}</td>
                  <td />
                  <td className="py-2 text-right text-gold-text tabular-nums">
                    {money(allShops.data.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <Skeleton className="h-24 rounded-xl" />
          )}
        </section>
      )}
    </div>
  );
}

function Change({ current, previous }: { current: string; previous: string }) {
  const t = useTranslations("sales");
  const prev = dec(previous);
  if (prev.isZero()) return <span>{t("noComparison")}</span>;
  const pct = dec(current).minus(prev).dividedBy(prev).times(100);
  const up = !pct.isNegative();
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        up ? "text-success" : "text-primary",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {up ? "+" : ""}
      {pct.toFixed(1)}% {t("vsPrevious")}
    </span>
  );
}

function RevenueChart({ data }: { data: SalesReport }) {
  const t = useTranslations("sales");
  const money = useMoney();
  const format = useFormatter();
  const label = (bucket: string) => {
    const d = new Date(`${bucket}T00:00:00+07:00`);
    if (data.group === "month")
      return format.dateTime(d, {
        month: "short",
        year: "2-digit",
        timeZone: "Asia/Bangkok",
      });
    return format.dateTime(d, {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Bangkok",
    });
  };
  const config = {
    revenue: { label: t("currentPeriod"), color: "var(--primary)" },
    previousRevenue: { label: t("previousPeriod"), color: "#8a8a8a" },
  } satisfies ChartConfig;
  const rows = data.chart.map((r) => ({
    ...r,
    revenue: Number(r.revenue),
    previousRevenue:
      r.previousRevenue === null ? null : Number(r.previousRevenue),
  }));

  return (
    <ChartContainer config={config} className="h-72 w-full">
      <LineChart
        data={rows}
        margin={{ left: 4, right: 12, top: 8 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={label}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) =>
            format.number(v, { notation: "compact" })
          }
        />
        <ChartTooltip
          cursor={{ strokeWidth: 1 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as
                  | (typeof rows)[number]
                  | undefined;
                return p ? label(p.bucket) : "";
              }}
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {config[name as keyof typeof config]?.label}
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {money(value as number)}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="previousRevenue"
          type="monotone"
          stroke="var(--color-previousRevenue)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          dataKey="revenue"
          type="monotone"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </LineChart>
    </ChartContainer>
  );
}

function Breakdown({
  title,
  rows,
  labelKey,
  loading,
}: {
  title: string;
  rows: { key: string; revenue: string; orders: number }[] | undefined;
  labelKey?: "channels" | "methods";
  loading: boolean;
}) {
  const tc = useTranslations("channels");
  const tm = useTranslations("sales.methods");
  const ts = useTranslations("sales");
  const money = useMoney();
  const sorted = [...(rows ?? [])].sort(
    (a, b) => Number(b.revenue) - Number(a.revenue),
  );
  const max = Math.max(1, ...sorted.map((r) => Number(r.revenue)));
  const name = (key: string) =>
    labelKey === "channels"
      ? tc(key as never)
      : labelKey === "methods"
        ? tm(key as never)
        : key;
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-card">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {loading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : sorted.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          {ts("noData")}
        </p>
      ) : (
        <ul className="grid gap-3">
          {sorted.map((r) => (
            <li
              key={r.key}
              title={`${name(r.key)}: ${money(r.revenue)} · ${ts("orderCount", { count: r.orders })}`}
            >
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{name(r.key)}</span>
                <span className="shrink-0 tabular-nums">
                  {money(r.revenue)}{" "}
                  <span className="text-muted-foreground text-xs">
                    · {r.orders}
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${(Number(r.revenue) / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TopList({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: { key: string; quantity: number; revenue: string }[] | undefined;
  loading: boolean;
}) {
  const t = useTranslations("sales");
  const money = useMoney();
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-card">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {loading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !rows?.length ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          {t("noData")}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className="py-2 font-normal">#</th>
              <th className="py-2 font-normal">{t("name")}</th>
              <th className="py-2 text-right font-normal">{t("qty")}</th>
              <th className="py-2 text-right font-normal">{t("revenue")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className="border-t">
                <td className="py-2 text-muted-foreground tabular-nums">
                  {i + 1}
                </td>
                <td className="py-2">{r.key}</td>
                <td className="py-2 text-right tabular-nums">{r.quantity}</td>
                <td className="py-2 text-right tabular-nums">
                  {money(r.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
