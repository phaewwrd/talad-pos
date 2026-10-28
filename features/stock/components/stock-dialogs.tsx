"use client";

import { useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAppForm } from "@/components/form/app-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { catalogKeys } from "@/features/catalog/hooks";
import { type ApiError, unwrap } from "@/lib/api/client";
import { bangkokDateString } from "@/lib/time";
import { useErrorMessage } from "@/lib/use-error-message";
import { adjustStock, getLotSuggestion, stockIn } from "../actions";
import { stockKeys } from "../hooks";
import { ADJUSTMENT_TYPES, adjustStockSchema, stockInSchema } from "../schemas";
import type { StockProductDTO } from "../types";

function useStockMutation<T>(
  orgId: string,
  fn: (input: T) => Promise<unknown>,
  done: () => void,
) {
  const t = useTranslations("stock");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: stockKeys.all(orgId) });
      queryClient.invalidateQueries({ queryKey: catalogKeys.products(orgId) });
      done();
    },
    onError: (err: ApiError) =>
      toast.error(errorMessage(err.code, err.details)),
  });
}

function issuesToFields(issues: { path: PropertyKey[]; message: string }[]) {
  return {
    fields: Object.fromEntries(
      issues.map((i) => [String(i.path[0]), { message: i.message }]),
    ),
  };
}

export function StockInDialog({
  orgId,
  product,
  products,
  open,
  onOpenChange,
}: {
  orgId: string;
  product: StockProductDTO | null;
  products: StockProductDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("stock");
  const mutation = useStockMutation(
    orgId,
    async (v: unknown) => unwrap(await stockIn(v)),
    () => onOpenChange(false),
  );

  const form = useAppForm({
    defaultValues: {
      productId: product?.id ?? products[0]?.id ?? "",
      lotNumber: "",
      stockInDate: bangkokDateString(new Date()),
      expiryDate: "",
      quantity: "",
      unitCost: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const r = stockInSchema.safeParse(value);
        return r.success ? undefined : issuesToFields(r.error.issues);
      },
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value).catch(() => {});
    },
  });

  // Suggest the next lot number whenever the product changes.
  const productId = useStore(form.store, (s) => s.values.productId);
  useEffect(() => {
    if (!productId || !open) return;
    let cancelled = false;
    getLotSuggestion(productId).then((r) => {
      if (!cancelled && r.ok) form.setFieldValue("lotNumber", r.data.lotNumber);
    });
    return () => {
      cancelled = true;
    };
  }, [productId, open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("stockIn")}</DialogTitle>
          <DialogDescription>{t("stockInDescription")}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="grid gap-4"
        >
          <form.AppField name="productId">
            {(f) => (
              <f.SelectField
                label={t("product")}
                options={products.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.sku})`,
                }))}
              />
            )}
          </form.AppField>
          <div className="grid grid-cols-2 gap-3">
            <form.AppField name="lotNumber">
              {(f) => <f.TextField label={t("lotNumber")} />}
            </form.AppField>
            <form.AppField name="quantity">
              {(f) => <f.TextField label={t("quantity")} inputMode="numeric" />}
            </form.AppField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <form.AppField name="stockInDate">
              {(f) => <f.TextField label={t("stockInDate")} type="date" />}
            </form.AppField>
            <form.AppField name="expiryDate">
              {(f) => (
                <f.TextField
                  label={t("expiryDate")}
                  type="date"
                  hint={t("optional")}
                />
              )}
            </form.AppField>
          </div>
          <form.AppField name="unitCost">
            {(f) => (
              <f.TextField
                label={t("unitCost")}
                inputMode="decimal"
                placeholder="0.00"
              />
            )}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton>{t("stockIn")}</form.SubmitButton>
          </form.AppForm>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdjustStockDialog({
  orgId,
  product,
  open,
  onOpenChange,
}: {
  orgId: string;
  product: StockProductDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("stock");
  const mutation = useStockMutation(
    orgId,
    async (v: unknown) => unwrap(await adjustStock(v)),
    () => onOpenChange(false),
  );
  const lots = product.lots;
  const defaultLot = lots.find((l) => l.remainingQuantity > 0) ?? lots[0];

  const form = useAppForm({
    defaultValues: {
      productId: product.id,
      lotId: defaultLot?.id ?? "",
      type: "adjust_down" as (typeof ADJUSTMENT_TYPES)[number],
      quantity: "",
      reason: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const r = adjustStockSchema.safeParse(value);
        return r.success ? undefined : issuesToFields(r.error.issues);
      },
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("adjust")}</DialogTitle>
          <DialogDescription>{product.name}</DialogDescription>
        </DialogHeader>
        {lots.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noLots")}</p>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="grid gap-4"
          >
            <form.AppField name="lotId">
              {(f) => (
                <f.SelectField
                  label={t("lot")}
                  options={lots.map((l) => ({
                    value: l.id,
                    label: `${l.lotNumber} · ${t("remaining", { count: l.remainingQuantity })}`,
                  }))}
                />
              )}
            </form.AppField>
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="type">
                {(f) => (
                  <f.SelectField
                    label={t("adjustType")}
                    options={ADJUSTMENT_TYPES.map((type) => ({
                      value: type,
                      label: t(`types.${type}`),
                    }))}
                  />
                )}
              </form.AppField>
              <form.AppField name="quantity">
                {(f) => (
                  <f.TextField label={t("quantity")} inputMode="numeric" />
                )}
              </form.AppField>
            </div>
            <form.AppField name="reason">
              {(f) => <f.TextareaField label={t("reason")} maxLength={200} />}
            </form.AppField>
            <form.AppForm>
              <form.SubmitButton>{t("adjust")}</form.SubmitButton>
            </form.AppForm>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
