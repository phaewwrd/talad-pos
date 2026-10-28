import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("errorPage");
  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <EmptyState
        icon={SearchX}
        title={t("notFound")}
        action={
          <Link href="/pos" className="text-gold-text text-sm hover:underline">
            {t("home")}
          </Link>
        }
      />
    </div>
  );
}
