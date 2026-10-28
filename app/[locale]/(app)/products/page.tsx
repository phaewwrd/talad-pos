import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { ProductsView } from "@/features/catalog/components/products-view";
import { requireMember } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.products");
  return { title: t("title") };
}

export default async function ProductsPage() {
  const [t, ctx] = await Promise.all([
    getTranslations("pages.products"),
    requireMember(),
  ]);
  return (
    <>
      <PageHeader title={t("title")} />
      <ProductsView orgId={ctx.organizationId} role={ctx.role} />
    </>
  );
}
