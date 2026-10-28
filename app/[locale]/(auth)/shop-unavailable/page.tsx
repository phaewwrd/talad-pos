import { Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ShopUnavailableActions } from "@/features/auth/components/shop-unavailable-actions";

export async function generateMetadata() {
  const t = await getTranslations("shopUnavailable");
  return { title: t("title") };
}

export default async function ShopUnavailablePage({
  searchParams,
}: PageProps<"/[locale]/shop-unavailable">) {
  const t = await getTranslations("shopUnavailable");
  return (
    <AuthCard title={t("title")}>
      <div className="grid justify-items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Store className="size-6" aria-hidden />
        </span>
        <Suspense fallback={<p className="h-10" />}>
          <Reason searchParams={searchParams} />
        </Suspense>
        <ShopUnavailableActions />
      </div>
    </AuthCard>
  );
}

async function Reason({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/shop-unavailable">["searchParams"];
}) {
  const t = await getTranslations("errors");
  const { reason } = await searchParams;
  return (
    <p className="text-muted-foreground text-sm">
      {reason === "closed" ? t("SHOP_CLOSED") : t("SHOP_SUSPENDED")}
    </p>
  );
}
