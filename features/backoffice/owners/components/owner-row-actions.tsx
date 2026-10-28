"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  KeyRound,
  MoreHorizontal,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { useErrorMessage } from "@/lib/use-error-message";
import { useCan } from "../../components/backoffice-context";
import { banOwner, sendOwnerPasswordReset, unbanOwner } from "../actions";
import type { OwnerDTO } from "../queries";

export function OwnerRowActions({ owner }: { owner: OwnerDTO }) {
  const t = useTranslations("backoffice.owners");
  const locale = useLocale();
  const can = useCan();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<"ban" | "unban" | "reset" | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["backoffice", "owners"] });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label={t("actionsFor", { email: owner.email })}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/backoffice/shops?ownerId=${owner.id}`}>
              <Store className="size-4" /> {t("viewShops")}
            </Link>
          </DropdownMenuItem>
          {can("owner.passwordReset") && (
            <DropdownMenuItem onSelect={() => setDialog("reset")}>
              <KeyRound className="size-4" /> {t("sendReset")}
            </DropdownMenuItem>
          )}
          {can("owner.ban") && (
            <>
              <DropdownMenuSeparator />
              {owner.banned ? (
                <DropdownMenuItem onSelect={() => setDialog("unban")}>
                  <ShieldCheck className="size-4" /> {t("unban")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDialog("ban")}
                >
                  <Ban className="size-4" /> {t("ban")}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === "ban" || dialog === "unban"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={
          dialog === "unban"
            ? t("unbanTitle", { email: owner.email })
            : t("banTitle", { email: owner.email })
        }
        description={
          dialog === "unban" ? t("unbanDescription") : t("banDescription")
        }
        confirmLabel={dialog === "unban" ? t("unban") : t("ban")}
        destructive={dialog === "ban"}
        requireReason
        onConfirm={async (reason) => {
          const action = dialog === "unban" ? unbanOwner : banOwner;
          const r = await action({ userId: owner.id, reason });
          setDialog(null);
          refresh();
          if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
          toast.success(dialog === "unban" ? t("unbanned") : t("bannedToast"));
        }}
      />
      <ConfirmDialog
        open={dialog === "reset"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("resetTitle")}
        description={t("resetDescription", { email: owner.email })}
        confirmLabel={t("sendReset")}
        onConfirm={async () => {
          const r = await sendOwnerPasswordReset({ userId: owner.id, locale });
          setDialog(null);
          if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
          toast.success(t("resetSent", { email: owner.email }));
        }}
      />
    </>
  );
}
