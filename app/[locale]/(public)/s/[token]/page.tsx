import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkUnavailable } from "@/features/suppliers/components/link-unavailable";
import { PinScreen } from "@/features/suppliers/components/pin-screen";
import { PublicStockView } from "@/features/suppliers/components/public-stock-view";
import {
  findLink,
  loadPublicStock,
  recordView,
} from "@/features/suppliers/public";
import {
  hashIp,
  hitRateLimit,
  isValidUnlockCookie,
  unlockCookieName,
} from "@/features/suppliers/security";

// Public, no login. Unknown/disabled tokens are answered with a 404 by
// proxy.ts before rendering; the checks here cover changes in between.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("supplierView");
  return {
    title: t("title"),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default function SupplierStockPage({
  params,
}: PageProps<"/[locale]/s/[token]">) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-4 py-6">
      <Suspense fallback={<StockSkeleton />}>
        <SupplierStock params={params} />
      </Suspense>
    </main>
  );
}

async function SupplierStock({
  params,
}: {
  params: PageProps<"/[locale]/s/[token]">["params"];
}) {
  // Everything below is per-request (rate limit, PIN cookie, view count), so
  // wait for a real request: headers() alone still resolves in a runtime
  // prerender, which would count the view twice.
  await connection();
  const h = await headers();
  const { token } = await params;
  const link = await findLink(token);
  if (!link) notFound();

  const ipHash = hashIp(h);
  if (!(await hitRateLimit(link.id, ipHash, "page"))) {
    return <LinkUnavailable reason="rateLimited" />;
  }
  if (link.pinHash) {
    const cookie = (await cookies()).get(unlockCookieName(token))?.value;
    if (!isValidUnlockCookie(link, cookie)) return <PinScreen token={token} />;
  }

  const userAgent = h.get("user-agent");
  after(() => recordView(link.id, ipHash, userAgent));
  return (
    <PublicStockView token={token} initial={await loadPublicStock(link)} />
  );
}

function StockSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-11 w-full rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-[70px] rounded-2xl" />
      ))}
    </div>
  );
}
