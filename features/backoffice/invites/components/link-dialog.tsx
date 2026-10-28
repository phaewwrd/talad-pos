"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Shows a freshly issued signup link once, and tries to copy it right away. */
export function LinkDialog({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const t = useTranslations("backoffice.invites");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    navigator.clipboard
      .writeText(url)
      .then(() => setCopied(true))
      .catch(() => {});
  }, [url]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("linkTitle")}</DialogTitle>
          <DialogDescription>{t("linkDescription")}</DialogDescription>
        </DialogHeader>
        <Input
          readOnly
          value={url}
          aria-label={t("linkTitle")}
          className="h-11 rounded-xl font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />
        <Button
          className="h-12 rounded-full"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? t("copied") : t("copyLink")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
