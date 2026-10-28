import { count, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { db } from "@/db";
import { member } from "@/db/schema";
import { SalesView } from "@/features/sales/components/sales-view";
import { requireMember } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.sales");
  return { title: t("title") };
}

export default async function SalesPage() {
  const [t, ctx] = await Promise.all([
    getTranslations("pages.sales"),
    requireMember(),
  ]);
  const [{ value: shopCount }] =
    ctx.role === "owner"
      ? await db
          .select({ value: count() })
          .from(member)
          .where(eq(member.userId, ctx.user.id))
      : [{ value: 1 }];
  return (
    <>
      <PageHeader title={t("title")} />
      <SalesView
        orgId={ctx.organizationId}
        role={ctx.role}
        canExport={ctx.entitlements.features.export && ctx.role !== "cashier"}
        shopCount={shopCount}
      />
    </>
  );
}
