"use client";

import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, UserRoundCog } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { useErrorMessage } from "@/lib/use-error-message";
import { useCan } from "../../components/backoffice-context";
import { impersonateOwner, sendOwnerPasswordReset } from "../../owners/actions";
import type { ShopDetailDTO } from "../queries";
import { shopActivityKey } from "./shop-activity-tab";

export function ShopSupportTab({ shop }: { shop: ShopDetailDTO }) {
  const t = useTranslations("backoffice.shop");
  const locale = useLocale();
  const can = useCan();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [resetting, setResetting] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const owner = shop.ownerInfo;

  if (!owner) {
    return <p className="text-muted-foreground text-sm">{t("noOwner")}</p>;
  }

  return (
    <div className="grid max-w-3xl gap-4">
      {can("owner.passwordReset") && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-card">
          <div className="grid gap-0.5">
            <h2 className="font-medium">{t("passwordReset")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("passwordResetDescription", { email: owner.email })}
            </p>
          </div>
          <ConfirmDialog
            open={resetting}
            onOpenChange={setResetting}
            title={t("passwordResetTitle")}
            description={t("passwordResetDescription", { email: owner.email })}
            confirmLabel={t("sendResetEmail")}
            onConfirm={async () => {
              const r = await sendOwnerPasswordReset({
                userId: owner.id,
                locale,
              });
              if (!r.ok)
                return void toast.error(errorMessage(r.code, r.details));
              toast.success(t("resetSent", { email: owner.email }));
              queryClient.invalidateQueries({
                queryKey: shopActivityKey(shop.id),
              });
            }}
          >
            <Button variant="outline" className="h-10 rounded-full">
              <KeyRound className="size-4" /> {t("sendResetEmail")}
            </Button>
          </ConfirmDialog>
        </section>
      )}

      {can("owner.impersonate") && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-soft/40 p-4 shadow-card">
          <div className="grid gap-0.5">
            <h2 className="font-medium">{t("impersonate")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("impersonateDescription")}
            </p>
          </div>
          <ConfirmDialog
            open={impersonating}
            onOpenChange={setImpersonating}
            title={t("impersonateTitle", { name: owner.name })}
            description={t("impersonateConfirm")}
            confirmLabel={t("impersonateStart")}
            destructive
            requireReason
            disabled={owner.banned || shop.status !== "active"}
            onConfirm={async (reason) => {
              const r = await impersonateOwner({
                userId: owner.id,
                organizationId: shop.id,
                reason,
              });
              if (!r.ok)
                return void toast.error(errorMessage(r.code, r.details));
              queryClient.clear();
              router.replace(r.data.redirectTo);
              router.refresh();
            }}
          >
            <Button
              className="h-10 rounded-full"
              disabled={owner.banned || shop.status !== "active"}
            >
              <UserRoundCog className="size-4" /> {t("impersonateStart")}
            </Button>
          </ConfirmDialog>
          {(owner.banned || shop.status !== "active") && (
            <p className="w-full text-muted-foreground text-xs">
              {t("impersonateUnavailable")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
