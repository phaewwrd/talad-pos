import { count, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { member } from "@/db/schema";
import { SalesView } from "@/features/sales/components/sales-view";
import { requirePageMember } from "@/lib/page-guard";

export async function generateMetadata() {
  const t = await getTranslations("pages.sales");
  return { title: t("title") };
}

export default async function SalesPage() {
  const t = await getTranslations("pages.sales");
  return (
    <>
      <PageHeader title={t("title")} />
      <Suspense fallback={<SalesSkeleton />}>
        <SalesContent />
      </Suspense>
    </>
  );
}

async function SalesContent() {
  const ctx = await requirePageMember();
  const [{ value: shopCount }] =
    ctx.role === "owner"
      ? await db
          .select({ value: count() })
          .from(member)
          .where(eq(member.userId, ctx.user.id))
      : [{ value: 1 }];
  return (
    <SalesView
      orgId={ctx.organizationId}
      role={ctx.role}
      canExport={ctx.entitlements.features.export && ctx.role !== "cashier"}
      shopCount={shopCount}
    />
  );
}

function SalesSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-10 w-full max-w-md rounded-full" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
