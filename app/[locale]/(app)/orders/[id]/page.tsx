import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { requirePageMember } from "@/lib/page-guard";

export async function generateMetadata() {
  const t = await getTranslations("pages.orders");
  return { title: t("title") };
}

export default function OrderDetailPage({
  params,
}: PageProps<"/[locale]/orders/[id]">) {
  return (
    <Suspense fallback={<OrderDetailSkeleton />}>
      <OrderDetailContent params={params} />
    </Suspense>
  );
}

async function OrderDetailContent({
  params,
}: Pick<PageProps<"/[locale]/orders/[id]">, "params">) {
  const [{ id }, ctx] = await Promise.all([params, requirePageMember()]);
  return (
    <OrderDetail
      orgId={ctx.organizationId}
      orderId={id}
      role={ctx.role}
      userId={ctx.user.id}
    />
  );
}

// Same shape as OrderDetail's own pending state.
function OrderDetailSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
