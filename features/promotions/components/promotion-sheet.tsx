"use client";

import { useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MultiSelect } from "@/components/common/multi-select";
import { useAppForm } from "@/components/form/app-form";
import { FieldError } from "@/components/form/field-error";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CategoryDTO, ProductDTO } from "@/features/catalog/types";
import { type ApiError, unwrap } from "@/lib/api/client";
import { useMoney } from "@/lib/format";
import { addDays, toBangkokLocal } from "@/lib/time";
import { useErrorMessage } from "@/lib/use-error-message";
import { createPromotion, updatePromotion } from "../actions";
import { type PromotionInput, promotionSchema } from "../schemas";
import type { PromotionDTO } from "../types";

type Values = {
  name: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  minimumType: "quantity" | "amount";
  minimumQuantity: string;
  minimumAmount: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  productIds: string[];
  categoryIds: string[];
};

export function PromotionSheet({
  orgId,
  promotion,
  products,
  categories,
  onClose,
}: {
  orgId: string;
  promotion: PromotionDTO | null;
  products: ProductDTO[];
  categories: CategoryDTO[];
  onClose: () => void;
}) {
  const t = useTranslations("promotions");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async (input: PromotionInput) =>
      unwrap(
        promotion
          ? await updatePromotion(promotion.id, input)
          : await createPromotion(input),
      ),
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: ["promotions", orgId] });
      queryClient.invalidateQueries({ queryKey: ["pos", orgId] });
      onClose();
    },
    onError: (err: ApiError) =>
      toast.error(errorMessage(err.code, err.details)),
  });

  const now = new Date();
  const form = useAppForm({
    defaultValues: {
      name: promotion?.name ?? "",
      discountType: promotion?.discountType ?? "percentage",
      discountValue: promotion?.discountValue ?? "",
      minimumType: promotion?.minimumType ?? "quantity",
      minimumQuantity: String(promotion?.minimumQuantity ?? 1),
      minimumAmount: promotion?.minimumAmount ?? "",
      startAt: toBangkokLocal(promotion?.startAt ?? now),
      endAt: toBangkokLocal(promotion?.endAt ?? addDays(now, 30)),
      isActive: promotion?.isActive ?? true,
      productIds: promotion?.productIds ?? [],
      categoryIds: promotion?.categoryIds ?? [],
    } as Values,
    validators: {
      onSubmit: ({ value }) => {
        const r = promotionSchema.safeParse(value);
        if (r.success) return undefined;
        return {
          fields: Object.fromEntries(
            r.error.issues.map((i) => [
              String(i.path[0]),
              { message: i.message },
            ]),
          ),
        };
      },
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value).catch(() => {});
    },
  });

  const values = useStore(form.store, (s) => s.values);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{promotion ? t("edit") : t("create")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("formDescription")}
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="grid gap-4 px-4 pb-6"
        >
          <PromotionPreview values={values} />
          <form.AppField name="name">
            {(f) => <f.TextField label={t("name")} />}
          </form.AppField>
          <div className="grid grid-cols-2 gap-3">
            <form.AppField name="discountType">
              {(f) => (
                <f.SelectField
                  label={t("discountType")}
                  options={[
                    { value: "percentage", label: t("percentage") },
                    { value: "fixed", label: t("fixed") },
                  ]}
                />
              )}
            </form.AppField>
            <form.AppField name="discountValue">
              {(f) => (
                <f.TextField
                  label={
                    values.discountType === "percentage"
                      ? t("valuePercent")
                      : t("valueBaht")
                  }
                  inputMode="decimal"
                />
              )}
            </form.AppField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <form.AppField name="minimumType">
              {(f) => (
                <f.SelectField
                  label={t("minimumType")}
                  options={[
                    { value: "quantity", label: t("minQuantity") },
                    { value: "amount", label: t("minAmount") },
                  ]}
                />
              )}
            </form.AppField>
            {values.minimumType === "quantity" ? (
              <form.AppField name="minimumQuantity">
                {(f) => (
                  <f.TextField
                    label={t("minimumQuantity")}
                    inputMode="numeric"
                  />
                )}
              </form.AppField>
            ) : (
              <form.AppField name="minimumAmount">
                {(f) => (
                  <f.TextField label={t("minimumAmount")} inputMode="decimal" />
                )}
              </form.AppField>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <form.AppField name="startAt">
              {(f) => (
                <f.TextField label={t("startAt")} type="datetime-local" />
              )}
            </form.AppField>
            <form.AppField name="endAt">
              {(f) => <f.TextField label={t("endAt")} type="datetime-local" />}
            </form.AppField>
          </div>
          <p className="-mt-2 text-muted-foreground text-xs">
            {t("timezoneHint")}
          </p>
          <form.Field name="productIds">
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor="promo-products">{t("targetProducts")}</Label>
                <MultiSelect
                  id="promo-products"
                  options={products.map((p) => ({
                    value: p.id,
                    label: p.name,
                    hint: p.sku,
                  }))}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  placeholder={t("pickProducts")}
                  searchPlaceholder={t("search")}
                  emptyText={t("noMatch")}
                  removeLabel={(label) => t("removeTarget", { label })}
                />
                <FieldError
                  id="promo-products-error"
                  errors={
                    form.state.submissionAttempts > 0
                      ? field.state.meta.errors
                      : []
                  }
                />
              </div>
            )}
          </form.Field>
          <form.Field name="categoryIds">
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor="promo-categories">
                  {t("targetCategories")}
                </Label>
                <MultiSelect
                  id="promo-categories"
                  options={categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  placeholder={t("pickCategories")}
                  searchPlaceholder={t("search")}
                  emptyText={t("noMatch")}
                  removeLabel={(label) => t("removeTarget", { label })}
                />
              </div>
            )}
          </form.Field>
          <form.AppField name="isActive">
            {(f) => <f.SwitchField label={t("active")} />}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton>{t("save")}</form.SubmitButton>
          </form.AppForm>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Live "ซื้อครบ X ลด Y" preview. */
export function PromotionPreview({
  values,
}: {
  values: Pick<
    Values,
    | "discountType"
    | "discountValue"
    | "minimumType"
    | "minimumQuantity"
    | "minimumAmount"
  >;
}) {
  const t = useTranslations("promotions");
  const money = useMoney();
  const value = values.discountValue || "0";
  const discount =
    values.discountType === "percentage" ? `${Number(value)}%` : money(value);
  const minimum =
    values.minimumType === "quantity"
      ? t("previewQty", { count: Number(values.minimumQuantity) || 1 })
      : t("previewAmount", { amount: money(values.minimumAmount || "0") });
  return (
    <div className="rounded-2xl bg-gold-soft p-4 text-center">
      <p className="text-muted-foreground text-xs">{t("preview")}</p>
      <p className="font-semibold text-gold-text text-lg">
        {t("previewText", { minimum, discount })}
      </p>
    </div>
  );
}
