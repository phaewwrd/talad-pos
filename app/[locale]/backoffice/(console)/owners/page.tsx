import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnersView } from "@/features/backoffice/owners/components/owners-view";

export async function generateMetadata() {
  const t = await getTranslations("backoffice.owners");
  return { title: t("title") };
}

export default function BackofficeOwnersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <OwnersView />
    </Suspense>
  );
}
