import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { OrdersView } from "@/features/orders/components/orders-view";
import { requireMember } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.orders");
  return { title: t("title") };
}

export default async function OrdersPage() {
  const [t, ctx] = await Promise.all([
    getTranslations("pages.orders"),
    requireMember(),
  ]);
  return (
    <>
      <PageHeader title={t("title")} />
      <OrdersView
        orgId={ctx.organizationId}
        role={ctx.role}
        userId={ctx.user.id}
      />
    </>
  );
}
