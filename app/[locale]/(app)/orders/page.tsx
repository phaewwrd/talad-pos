import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { OrdersView } from "@/features/orders/components/orders-view";
import { requirePageMember } from "@/lib/page-guard";

export async function generateMetadata() {
  const t = await getTranslations("pages.orders");
  return { title: t("title") };
}

export default async function OrdersPage() {
  const t = await getTranslations("pages.orders");
  return (
    <>
      <PageHeader title={t("title")} />
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersContent />
      </Suspense>
    </>
  );
}

async function OrdersContent() {
  const ctx = await requirePageMember();
  return (
    <OrdersView
      orgId={ctx.organizationId}
      role={ctx.role}
      userId={ctx.user.id}
    />
  );
}

function OrdersSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
