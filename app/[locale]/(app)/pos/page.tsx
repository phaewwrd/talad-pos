import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PosScreen } from "@/features/pos/components/pos-screen";
import { requirePageMember } from "@/lib/page-guard";

export async function generateMetadata() {
  const t = await getTranslations("pages.pos");
  return { title: t("title") };
}

export default function PosPage() {
  return (
    <Suspense fallback={<PosSkeleton />}>
      <PosContent />
    </Suspense>
  );
}

async function PosContent() {
  const ctx = await requirePageMember();
  return <PosScreen orgId={ctx.organizationId} />;
}

function PosSkeleton() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-11 w-full max-w-md rounded-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
