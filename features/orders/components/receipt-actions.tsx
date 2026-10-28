"use client";

import { FileDown, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function ReceiptActions({ width }: { width: 58 | 80 }) {
  const t = useTranslations("receipt");
  const pathname = usePathname();
  return (
    <div className="mx-auto mb-4 flex max-w-md flex-wrap items-center justify-center gap-2 print:hidden">
      <div className="flex rounded-full border bg-card p-1">
        {([58, 80] as const).map((w) => (
          <Link
            key={w}
            href={`${pathname}?w=${w}`}
            replace
            className={cn(
              "rounded-full px-3 py-1.5 text-sm",
              width === w && "bg-foreground text-background",
            )}
          >
            {w}mm
          </Link>
        ))}
      </div>
      <Button className="rounded-full" onClick={() => window.print()}>
        <Printer className="size-4" /> {t("print")}
      </Button>
      {/* TODO(decision): server-rendered PDF; browsers' "Save as PDF" print target is used for now. */}
      <Button
        variant="outline"
        className="rounded-full"
        onClick={() => window.print()}
        title={t("pdfHint")}
      >
        <FileDown className="size-4" /> {t("pdf")}
      </Button>
    </div>
  );
}
