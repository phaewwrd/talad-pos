import { getTranslations } from "next-intl/server";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { requireMember } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.orders");
  return { title: t("title") };
}

export default async function OrderDetailPage({
  params,
}: PageProps<"/[locale]/orders/[id]">) {
  const [{ id }, ctx] = await Promise.all([params, requireMember()]);
  return (
    <OrderDetail
      orgId={ctx.organizationId}
      orderId={id}
      role={ctx.role}
      userId={ctx.user.id}
    />
  );
}
