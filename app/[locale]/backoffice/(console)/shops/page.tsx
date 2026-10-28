import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopsView } from "@/features/backoffice/shops/components/shops-view";

export async function generateMetadata() {
  const t = await getTranslations("backoffice.shops");
  return { title: t("title") };
}

export default function BackofficeShopsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <ShopsView />
    </Suspense>
  );
}
