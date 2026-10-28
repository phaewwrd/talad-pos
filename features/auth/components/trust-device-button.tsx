"use client";

import { MonitorSmartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAppForm } from "@/components/form/app-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { useErrorMessage } from "@/lib/use-error-message";
import { trustThisDevice } from "../actions";
import { trustDeviceSchema } from "../schemas";

export function TrustDeviceButton({
  variant = "default",
}: {
  variant?: "default" | "outline";
}) {
  const t = useTranslations("auth");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useAppForm({
    defaultValues: { name: "" },
    validators: { onSubmit: trustDeviceSchema },
    onSubmit: async ({ value }) => {
      const result = await trustThisDevice(value);
      if (!result.ok) {
        toast.error(errorMessage(result.code, result.details));
        return;
      }
      toast.success(t("deviceTrusted"));
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className="h-12 rounded-full">
          <MonitorSmartphone className="size-4" aria-hidden />
          {t("useThisDevice")}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>{t("useThisDevice")}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="grid gap-4"
        >
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label={t("deviceName")}
                placeholder={t("deviceNamePlaceholder")}
              />
            )}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton>{t("useThisDevice")}</form.SubmitButton>
          </form.AppForm>
        </form>
      </DialogContent>
    </Dialog>
  );
}
