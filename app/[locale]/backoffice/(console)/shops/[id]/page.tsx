import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopDetailView } from "@/features/backoffice/shops/components/shop-detail-view";

export async function generateMetadata() {
  const t = await getTranslations("backoffice.shop");
  return { title: t("title") };
}

export default function BackofficeShopPage({
  params,
}: PageProps<"/[locale]/backoffice/shops/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <ShopDetail params={params} />
    </Suspense>
  );
}

async function ShopDetail({
  params,
}: {
  params: PageProps<"/[locale]/backoffice/shops/[id]">["params"];
}) {
  const { id } = await params;
  return <ShopDetailView id={id} />;
}
