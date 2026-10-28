"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  History,
  Link2,
  MoreHorizontal,
  Pencil,
  Send,
} from "lucide-react";
import { useTranslations } from "next-intl";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  isInviteEditable,
  isInviteUsable,
} from "@/lib/backoffice/invite-status";
import { useErrorMessage } from "@/lib/use-error-message";
import { useCan } from "../../components/backoffice-context";
import { copyInviteLink, revokeInvite, sendInvite } from "../actions";
import type { InviteDTO } from "../queries";

export function InviteRowActions({
  invite,
  onEdit,
  onDeliveryLog,
  onLink,
}: {
  invite: InviteDTO;
  onEdit: () => void;
  onDeliveryLog: () => void;
  onLink: (url: string) => void;
}) {
  const t = useTranslations("backoffice.invites");
  const can = useCan();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState(false);
  const [busy, setBusy] = useState(false);
  const usable = isInviteUsable(invite.status);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["backoffice", "invites"] });

  async function send() {
    setBusy(true);
    const r = await sendInvite({ id: invite.id });
    setBusy(false);
    refresh();
    if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
    toast.success(t("sentTo", { email: invite.email ?? "" }));
  }

  async function copy() {
    setBusy(true);
    const r = await copyInviteLink({ id: invite.id });
    setBusy(false);
    refresh();
    if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
    onLink(r.data.url);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            disabled={busy}
            aria-label={t("actionsFor", { label: invite.label })}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {usable && can("invite.send") && invite.email && (
            <DropdownMenuItem onSelect={send}>
              <Send className="size-4" />
              {invite.sendCount > 0 ? t("resend") : t("send")}
            </DropdownMenuItem>
          )}
          {usable && can("invite.send") && (
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuItem onSelect={copy}>
                  <Link2 className="size-4" /> {t("copyLink")}
                </DropdownMenuItem>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-60">
                {t("copyLinkTooltip")}
              </TooltipContent>
            </Tooltip>
          )}
          {isInviteEditable(invite.status) && can("invite.edit") && (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="size-4" /> {t("edit")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onDeliveryLog}>
            <History className="size-4" /> {t("deliveryLog")}
          </DropdownMenuItem>
          {isInviteEditable(invite.status) && can("invite.revoke") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setRevoking(true)}
              >
                <Ban className="size-4" /> {t("revoke")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={revoking}
        onOpenChange={setRevoking}
        title={t("revokeTitle", { label: invite.label })}
        description={t("revokeDescription")}
        confirmLabel={t("revoke")}
        destructive
        requireReason
        onConfirm={async (reason) => {
          const r = await revokeInvite({ id: invite.id, reason });
          refresh();
          if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
          toast.success(t("revoked"));
        }}
      />
    </>
  );
}
