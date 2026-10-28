"use client";

import { Banknote, Receipt, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatCard } from "@/components/common/stat-card";
import { Link } from "@/i18n/navigation";
import { useDateTime, useMoney } from "@/lib/format";
import { BannedChip, ShopStatusChip } from "../../components/status-chip";
import { UsageMeter } from "../../components/usage-meter";
import type { ShopDetailDTO } from "../queries";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

function Card({
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

export function ShopOverviewTab({ shop }: { shop: ShopDetailDTO }) {
  const t = useTranslations("backoffice.shop");
  const tl = useTranslations("backoffice.limits");
  const money = useMoney();
  const { date, dateTime } = useDateTime();
  const owner = shop.ownerInfo;
  const ent = owner?.entitlements;
  const maxShops = ent
    ? ent.features.multiShop
      ? ent.limits.maxShops
      : 1
    : null;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={Receipt}
          label={t("orders30d")}
          value={shop.sales.orders.toLocaleString()}
        />
        <StatCard
          icon={Banknote}
          tone="gold"
          label={t("gmv30d")}
          value={money(shop.sales.gmv)}
        />
        <StatCard
          icon={ShoppingBag}
          label={t("avgTicket")}
          value={money(shop.sales.avgTicket)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("settings")}>
          <div className="flex gap-4">
            {shop.settings?.logoUrl ? (
              // biome-ignore lint/performance/noImgElement: small remote logo preview
              <img
                src={shop.settings.logoUrl}
                alt={t("logoAlt", { name: shop.name })}
                className="size-16 shrink-0 rounded-xl border object-cover"
              />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted font-semibold text-muted-foreground text-xl">
                {shop.name.slice(0, 1)}
              </span>
            )}
            <dl className="grid flex-1 gap-2 sm:grid-cols-2">
              <Field
                label={t("name")}
                value={shop.settings?.displayName ?? shop.name}
              />
              <Field label={t("phone")} value={shop.settings?.phone} />
              <Field label={t("taxId")} value={shop.settings?.taxId} />
              <Field label={t("created")} value={date(shop.createdAt)} />
              <div className="sm:col-span-2">
                <Field label={t("address")} value={shop.settings?.address} />
              </div>
            </dl>
          </div>
        </Card>

        <Card title={t("ownerCard")}>
          {owner ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              <Field label={t("ownerName")} value={owner.name} />
              <Field label={t("ownerEmail")} value={owner.email} />
              <Field
                label={t("account")}
                value={<BannedChip banned={owner.banned} />}
              />
              <Field
                label={t("lastLogin")}
                value={owner.lastLoginAt ? dateTime(owner.lastLoginAt) : null}
              />
              <Field label={t("ownerSince")} value={date(owner.createdAt)} />
              <Field
                label={t("shopsOwned")}
                value={
                  <Link
                    href={`/backoffice/shops?ownerId=${owner.id}`}
                    className="text-gold-text hover:underline"
                  >
                    {owner.shopsOwned}
                  </Link>
                }
              />
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">{t("noOwner")}</p>
          )}
        </Card>

        <Card title={t("usage")}>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Field
              label={tl("maxStaffPerShop")}
              value={
                <UsageMeter used={shop.staff.used} limit={shop.staff.limit} />
              }
            />
            <Field
              label={tl("maxProducts")}
              value={
                <UsageMeter
                  used={shop.products.used}
                  limit={shop.products.limit}
                />
              }
            />
            <Field
              label={tl("maxShops")}
              value={
                owner ? (
                  <UsageMeter used={owner.shopsOwned} limit={maxShops} />
                ) : null
              }
            />
          </dl>
          {owner && !owner.hasEntitlementsRow && (
            <p className="mt-3 text-muted-foreground text-xs">
              {t("defaultPlan")}
            </p>
          )}
        </Card>

        <Card title={t("otherShops")}>
          {owner && owner.otherShops.length > 0 ? (
            <ul className="grid gap-2">
              {owner.otherShops.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2"
                >
                  <Link
                    href={`/backoffice/shops/${s.id}`}
                    className="font-medium text-sm hover:text-primary hover:underline"
                  >
                    {s.name}
                  </Link>
                  <ShopStatusChip status={s.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{t("noOtherShops")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
