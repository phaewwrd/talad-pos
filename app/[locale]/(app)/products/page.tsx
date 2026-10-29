import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductsView } from "@/features/catalog/components/products-view";
import { requirePageMember } from "@/lib/page-guard";

export async function generateMetadata() {
  const t = await getTranslations("pages.products");
  return { title: t("title") };
}

export default async function ProductsPage() {
  const t = await getTranslations("pages.products");
  return (
    <>
      <PageHeader title={t("title")} />
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsContent />
      </Suspense>
    </>
  );
}

async function ProductsContent() {
  const ctx = await requirePageMember();
  return <ProductsView orgId={ctx.organizationId} role={ctx.role} />;
}

function ProductsSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-10 w-full max-w-xs rounded-full" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
