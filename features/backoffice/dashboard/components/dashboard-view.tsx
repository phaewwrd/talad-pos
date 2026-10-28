"use client";

import { useQuery } from "@tanstack/react-query";
import { Banknote, Mail, Receipt, Store, TrendingUp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Link } from "@/i18n/navigation";
import { getJson } from "@/lib/api/client";
import { useDateTime, useMoney } from "@/lib/format";
import { InviteStatusChip } from "../../components/status-chip";
import { UsageMeter } from "../../components/usage-meter";
import type { DashboardDTO } from "../queries";

// Two single-series charts on the same 30-day axis (never a dual axis).
// New-shop bars use gold-text (#8A6D12): plain gold fails 3:1 on white.
function DailyChart({
  data,
  dataKey,
  color,
  format,
}: {
  data: { day: string; value: number }[];
  dataKey: string;
  color: string;
  format: (v: number) => string;
}) {
  const f = useFormatter();
  const label = (day: string) =>
    f.dateTime(new Date(`${day}T00:00:00+07:00`), {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Bangkok",
    });
  const config = { value: { label: dataKey, color } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart
        data={data}
        margin={{ left: 4, right: 8, top: 8 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickFormatter={label}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          allowDecimals={false}
          tickFormatter={(v: number) => f.number(v, { notation: "compact" })}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(_, p) =>
                label(String(p?.[0]?.payload?.day ?? ""))
              }
              formatter={(v) => (
                <span className="font-medium text-foreground tabular-nums">
                  {format(Number(v))}
                </span>
              )}
            />
          }
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-card">
      <h2 className="mb-3 font-medium">{title}</h2>
      {children}
    </section>
  );
}

export function DashboardView() {
  const t = useTranslations("backoffice.dashboard");
  const money = useMoney();
  const { dateTime } = useDateTime();
  const q = useQuery({
    queryKey: ["backoffice", "dashboard"],
    queryFn: () => getJson<DashboardDTO>("/api/backoffice/dashboard"),
  });
  const d = q.data;
  const loading = q.isPending;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Store}
          label={t("shops")}
          loading={loading}
          value={d?.shops.active ?? 0}
          hint={
            d &&
            t("shopsHint", {
              suspended: d.shops.suspended,
              closed: d.shops.closed,
            })
          }
        />
        <StatCard
          icon={TrendingUp}
          tone="success"
          label={t("newShops")}
          loading={loading}
          value={d?.newShops.thisMonth ?? 0}
          hint={d && t("lastMonth", { n: d.newShops.lastMonth })}
        />
        <StatCard
          icon={Mail}
          tone="gold"
          label={t("invites")}
          loading={loading}
          value={d ? d.invites.draft + d.invites.sent : 0}
          hint={d && t("invitesHint", d.invites)}
        />
        <StatCard
          icon={Receipt}
          label={t("ordersToday")}
          loading={loading}
          value={d?.sales.ordersToday ?? 0}
        />
        <StatCard
          icon={Banknote}
          tone="danger"
          label={t("gmvToday")}
          loading={loading}
          value={money(d?.sales.gmvToday)}
        />
        <StatCard
          icon={Banknote}
          tone="gold"
          label={t("gmv30d")}
          loading={loading}
          value={money(d?.sales.gmv30d)}
          hint={d && t("orders30d", { n: d.sales.orders30d })}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={t("dailyGmv")}>
          {d && (
            <DailyChart
              data={d.daily.map((x) => ({ day: x.day, value: Number(x.gmv) }))}
              dataKey={t("dailyGmv")}
              color="var(--primary)"
              format={(v) => money(v)}
            />
          )}
        </Panel>
        <Panel title={t("dailyNewShops")}>
          {d && (
            <DailyChart
              data={d.daily.map((x) => ({ day: x.day, value: x.newShops }))}
              dataKey={t("dailyNewShops")}
              color="var(--gold-text)"
              format={(v) => String(v)}
            />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title={t("nearLimit")}>
          {d?.nearLimit.length ? (
            <ul className="grid gap-3">
              {d.nearLimit.map((s) => (
                <li key={s.id} className="grid gap-1">
                  <Link
                    href={`/backoffice/shops/${s.id}`}
                    className="font-medium text-sm hover:underline"
                  >
                    {s.name}
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <UsageMeter used={s.staff.used} limit={s.staff.limit} />
                    <UsageMeter
                      used={s.products.used}
                      limit={s.products.limit}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{t("none")}</p>
          )}
        </Panel>
        <Panel title={t("expiringInvites")}>
          {d?.expiringInvites.length ? (
            <ul className="grid gap-2">
              {d.expiringInvites.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="grid">
                    <span className="font-medium">{i.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {dateTime(i.expiresAt)}
                    </span>
                  </span>
                  <InviteStatusChip status={i.sent ? "sent" : "draft"} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{t("none")}</p>
          )}
        </Panel>
        <Panel title={t("recentShops")}>
          {d?.recentShops.length ? (
            <ul className="grid gap-2">
              {d.recentShops.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <Link
                    href={`/backoffice/shops/${s.id}`}
                    className="font-medium hover:underline"
                  >
                    {s.name}
                  </Link>
                  <span className="text-muted-foreground text-xs">
                    {s.lastActivityAt && dateTime(s.lastActivityAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{t("none")}</p>
          )}
        </Panel>
      </div>
    </>
  );
}
