"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useErrorText } from "@/components/form/field-error";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EntitlementFeatures, EntitlementLimits } from "@/db/schema";
import { LIMIT_KEYS } from "@/lib/backoffice/presets";
import { useErrorMessage } from "@/lib/use-error-message";
import { AuditDiff } from "../../components/audit-diff";
import { useCan } from "../../components/backoffice-context";
import {
  FeaturesEditor,
  LimitsEditor,
  type LimitsValue,
} from "../../components/entitlements-editor";
import {
  featuresSchema,
  fromLimitField,
  limitsSchema,
  toLimitField,
} from "../../shared/entitlement-schemas";
import { updateOwnerEntitlements } from "../actions";
import type { ShopDetailDTO } from "../queries";
import { shopKey } from "./shop-detail-view";

function toLimitsValue(l: EntitlementLimits): LimitsValue {
  return Object.fromEntries(
    LIMIT_KEYS.map((k) => [k, toLimitField(l[k])]),
  ) as LimitsValue;
}

export function ShopPlanTab({ shop }: { shop: ShopDetailDTO }) {
  const t = useTranslations("backoffice.shop");
  const errorText = useErrorText();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const can = useCan();
  const editable = can("entitlement.edit");
  const owner = shop.ownerInfo;

  const initial = owner?.entitlements;
  const [limits, setLimits] = useState<LimitsValue>(() =>
    toLimitsValue(
      initial?.limits ?? { maxShops: 1, maxStaffPerShop: 1, maxProducts: 1 },
    ),
  );
  const [features, setFeatures] = useState<EntitlementFeatures | null>(
    initial?.features ?? null,
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof LimitsValue, string>>
  >({});
  const [pending, setPending] = useState<{
    limits: EntitlementLimits;
    features: EntitlementFeatures;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  if (!owner || !initial || !features) {
    return <p className="text-muted-foreground text-sm">{t("noOwner")}</p>;
  }

  const usage = {
    maxShops: owner.shopsOwned,
    maxStaffPerShop: shop.staff.used,
    maxProducts: shop.products.used,
  };
  const parsedLimits = Object.fromEntries(
    LIMIT_KEYS.map((k) => [k, fromLimitField(limits[k])]),
  ) as EntitlementLimits;
  const warnings = Object.fromEntries(
    LIMIT_KEYS.flatMap((k) => {
      const v = parsedLimits[k];
      return v !== null && Number.isFinite(v) && v < usage[k]
        ? [[k, t("belowUsage", { used: usage[k] })]]
        : [];
    }),
  );

  function review() {
    const l = limitsSchema.safeParse(parsedLimits);
    const f = featuresSchema.safeParse(features);
    if (!l.success || !f.success) {
      const next: Partial<Record<keyof LimitsValue, string>> = {};
      for (const issue of l.error?.issues ?? []) {
        next[String(issue.path[0]) as keyof LimitsValue] = errorText(issue);
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setPending({ limits: l.data, features: f.data });
  }

  async function save() {
    if (!pending) return;
    setSaving(true);
    const r = await updateOwnerEntitlements({
      organizationId: shop.id,
      ...pending,
      reason,
    });
    setSaving(false);
    if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
    toast.success(t("planSaved"));
    setPending(null);
    setReason("");
    queryClient.invalidateQueries({ queryKey: shopKey(shop.id) });
    queryClient.invalidateQueries({ queryKey: ["backoffice", "shops"] });
  }

  return (
    <div className="grid max-w-3xl gap-5 rounded-2xl border bg-card p-4 shadow-card">
      <p className="text-muted-foreground text-sm">
        {t("planAppliesToOwner", { count: owner.shopsOwned })}
      </p>
      {!editable && (
        <p className="rounded-xl bg-muted px-3 py-2 text-muted-foreground text-sm">
          {t("readOnlyPlan")}
        </p>
      )}
      <LimitsEditor
        value={limits}
        onChange={setLimits}
        errors={errors}
        warnings={warnings}
        disabled={!editable}
      />
      <FeaturesEditor
        value={features}
        onChange={setFeatures}
        disabled={!editable}
      />
      {Object.keys(warnings).length > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-warning/15 px-3 py-2 text-[#9a6608] text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("belowUsageNote")}
        </p>
      )}
      {editable && (
        <div className="flex justify-end">
          <Button className="h-11 rounded-full" onClick={review}>
            {t("reviewChanges")}
          </Button>
        </div>
      )}

      <AlertDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmPlanTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmPlanDescription", { email: owner.email })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending && (
            <AuditDiff
              before={{ limits: initial.limits, features: initial.features }}
              after={pending}
            />
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="plan-reason">{t("reason")}</Label>
            <Textarea
              id="plan-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              className="rounded-xl"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">
              {t("cancel")}
            </AlertDialogCancel>
            <Button
              className="rounded-full"
              disabled={saving || reason.trim() === ""}
              onClick={save}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t("savePlan")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
