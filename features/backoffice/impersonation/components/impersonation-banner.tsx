"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UserRoundX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { useErrorMessage } from "@/lib/use-error-message";
import { stopImpersonation } from "../actions";

/** Persistent red banner in the shop app while a super_admin impersonates. */
export function ImpersonationBanner({ ownerName }: { ownerName: string }) {
  const t = useTranslations("backoffice.impersonation");
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [stopping, setStopping] = useState(false);

  async function stop() {
    setStopping(true);
    const r = await stopImpersonation();
    if (!r.ok) {
      setStopping(false);
      return void toast.error(errorMessage(r.code, r.details));
    }
    queryClient.clear();
    router.replace(r.data.redirectTo);
    router.refresh();
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-primary px-4 py-2 text-center font-medium text-sm text-white"
    >
      <UserRoundX className="size-4 shrink-0" aria-hidden />
      <span>{t("banner", { owner: ownerName })}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={stop}
        disabled={stopping}
        className="h-8 rounded-full border-white bg-transparent text-white hover:bg-white hover:text-primary"
      >
        {stopping && <Loader2 className="size-3.5 animate-spin" />}
        {t("stop")}
      </Button>
    </div>
  );
}
