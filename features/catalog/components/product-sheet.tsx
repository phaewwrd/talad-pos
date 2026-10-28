"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAppForm } from "@/components/form/app-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ImageUpload } from "@/components/upload/image-upload";
import { type ApiError, unwrap } from "@/lib/api/client";
import { useErrorMessage } from "@/lib/use-error-message";
import { createProduct, updateProduct } from "../actions";
import { catalogKeys } from "../hooks";
import { type ProductInput, productSchema } from "../schemas";
import type { CategoryDTO, ProductDTO } from "../types";

type FormValues = {
  name: string;
  sku: string;
  categoryId: string;
  price: string;
  cost: string;
  minimumStock: string;
  isActive: boolean;
  imageUrl: string | null;
};

export function ProductSheet({
  orgId,
  open,
  onOpenChange,
  product,
  categories,
  showCost,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductDTO | null;
  categories: CategoryDTO[];
  showCost: boolean;
}) {
  const t = useTranslations("products");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: ProductInput) =>
      unwrap(
        product
          ? await updateProduct(product.id, input)
          : await createProduct(input),
      ),
    onSuccess: () => {
      toast.success(product ? t("saved") : t("created"));
      queryClient.invalidateQueries({ queryKey: catalogKeys.products(orgId) });
      queryClient.invalidateQueries({
        queryKey: catalogKeys.categories(orgId),
      });
      queryClient.invalidateQueries({ queryKey: ["stock", orgId] });
      onOpenChange(false);
    },
    onError: (err: ApiError) =>
      toast.error(errorMessage(err.code, err.details)),
  });

  const defaults: FormValues = {
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    categoryId: product?.categoryId ?? categories[0]?.id ?? "",
    price: product?.price ?? "",
    cost: product?.cost ?? "",
    minimumStock: String(product?.minimumStock ?? 0),
    isActive: product?.isActive ?? true,
    imageUrl: product?.imageUrl ?? null,
  };

  const form = useAppForm({
    defaultValues: defaults,
    validators: {
      onSubmit: ({ value }) => {
        const r = productSchema.safeParse(toInput(value, showCost));
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
      await mutation.mutateAsync(toInput(value, showCost)).catch(() => {});
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {product ? t("editProduct") : t("newProduct")}
          </SheetTitle>
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
          <form.Field name="imageUrl">
            {(field) => (
              <ImageUpload
                label={t("image")}
                value={field.state.value}
                onChange={(url) => field.handleChange(url)}
              />
            )}
          </form.Field>
          <form.AppField name="name">
            {(f) => <f.TextField label={t("name")} />}
          </form.AppField>
          <div className="grid grid-cols-2 gap-3">
            <form.AppField name="sku">
              {(f) => (
                <f.TextField label={t("sku")} autoCapitalize="characters" />
              )}
            </form.AppField>
            <form.AppField name="categoryId">
              {(f) => (
                <f.SelectField
                  label={t("category")}
                  options={categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                />
              )}
            </form.AppField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <form.AppField name="price">
              {(f) => (
                <f.TextField
                  label={t("price")}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              )}
            </form.AppField>
            {showCost && (
              <form.AppField name="cost">
                {(f) => (
                  <f.TextField
                    label={t("cost")}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                )}
              </form.AppField>
            )}
          </div>
          <form.AppField name="minimumStock">
            {(f) => (
              <f.TextField
                label={t("minimumStock")}
                inputMode="numeric"
                hint={t("minimumStockHint")}
              />
            )}
          </form.AppField>
          <form.AppField name="isActive">
            {(f) => (
              <f.SwitchField label={t("active")} hint={t("activeHint")} />
            )}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton>
              {product ? t("save") : t("create")}
            </form.SubmitButton>
          </form.AppForm>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function toInput(v: FormValues, showCost: boolean): ProductInput {
  return {
    name: v.name,
    sku: v.sku,
    categoryId: v.categoryId,
    price: v.price,
    cost: showCost ? v.cost || "0" : undefined,
    minimumStock: v.minimumStock,
    isActive: v.isActive,
    imageUrl: v.imageUrl,
  };
}
