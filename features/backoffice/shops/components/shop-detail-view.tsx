"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { ApiError, getJson } from "@/lib/api/client";
import { ShopStatusChip } from "../../components/status-chip";
import type { ShopDetailDTO } from "../queries";
import { ShopActivityTab } from "./shop-activity-tab";
import { ShopMembersTab } from "./shop-members-tab";
import { ShopOverviewTab } from "./shop-overview-tab";
import { ShopPlanTab } from "./shop-plan-tab";
import { ShopStatusTab } from "./shop-status-tab";
import { ShopSupportTab } from "./shop-support-tab";

const TABS = [
  "overview",
  "plan",
  "members",
  "status",
  "support",
  "activity",
] as const;
type Tab = (typeof TABS)[number];

export const shopKey = (id: string) => ["backoffice", "shops", id] as const;

export function ShopDetailView({ id }: { id: string }) {
  const t = useTranslations("backoffice.shop");
  const [tab, setTab] = useState<Tab>("overview");
  const shop = useQuery({
    queryKey: shopKey(id),
    queryFn: () => getJson<ShopDetailDTO>(`/api/backoffice/shops/${id}`),
    retry: (n, err) =>
      !(err instanceof ApiError && err.code === "NOT_FOUND") && n < 2,
  });

  if (shop.isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-full max-w-xl rounded-full" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }
  if (!shop.data) {
    return <EmptyState icon={SearchX} title={t("notFound")} />;
  }
  const data = shop.data;

  return (
    <>
      <Link
        href="/backoffice/shops"
        className="mb-3 inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t("back")}
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-semibold text-2xl tracking-tight">{data.name}</h1>
        <ShopStatusChip status={data.status} />
        {data.owner && (
          <span className="text-muted-foreground text-sm">
            {data.owner.email}
          </span>
        )}
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="mb-4 w-max">
            {TABS.map((k) => (
              <TabsTrigger key={k} value={k}>
                {t(`tabs.${k}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview">
          <ShopOverviewTab shop={data} />
        </TabsContent>
        <TabsContent value="plan">
          <ShopPlanTab shop={data} />
        </TabsContent>
        <TabsContent value="members">
          <ShopMembersTab shopId={data.id} />
        </TabsContent>
        <TabsContent value="status">
          <ShopStatusTab shop={data} />
        </TabsContent>
        <TabsContent value="support">
          <ShopSupportTab shop={data} />
        </TabsContent>
        <TabsContent value="activity">
          <ShopActivityTab shopId={data.id} />
        </TabsContent>
      </Tabs>
    </>
  );
}
