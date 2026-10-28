"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function AppError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations("errorPage");
  return (
    <EmptyState
      icon={TriangleAlert}
      title={t("title")}
      description={t("description")}
      action={
        <Button className="rounded-full" onClick={reset}>
          {t("retry")}
        </Button>
      }
    />
  );
}
