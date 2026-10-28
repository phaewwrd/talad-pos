"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent,
  CalendarRange,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategories, useProducts } from "@/features/catalog/hooks";
import { type ApiError, getJson, unwrap } from "@/lib/api/client";
import { useDateTime } from "@/lib/format";
import { useErrorMessage } from "@/lib/use-error-message";
import { deletePromotion, setPromotionActive } from "../actions";
import type { PromotionDTO, PromotionState } from "../types";
import { PromotionPreview, PromotionSheet } from "./promotion-sheet";

const TABS: PromotionState[] = ["active", "scheduled", "expired", "inactive"];

export function PromotionsView({ orgId }: { orgId: string }) {
  const t = useTranslations("promotions");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const promos = useQuery({
    queryKey: ["promotions", orgId],
    queryFn: () => getJson<PromotionDTO[]>("/api/promotions"),
  });
  const products = useProducts(orgId);
  const categories = useCategories(orgId);
  const [editing, setEditing] = useState<PromotionDTO | null | undefined>(
    undefined,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["promotions", orgId] });
    queryClient.invalidateQueries({ queryKey: ["pos", orgId] });
  };
  const onError = (err: ApiError) =>
    toast.error(errorMessage(err.code, err.details));
  const toggle = useMutation({
    mutationFn: async (v: { id: string; isActive: boolean }) =>
      unwrap(await setPromotionActive(v.id, v.isActive)),
    onSuccess: invalidate,
    onError,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await deletePromotion(id)),
    onSuccess: invalidate,
    onError,
  });

  const byState = (s: PromotionState) =>
    (promos.data ?? []).filter((p) => p.state === s);

  return (
    <Tabs defaultValue="active">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TabsList className="h-11 rounded-full p-1">
          {TABS.map((s) => (
            <TabsTrigger key={s} value={s} className="rounded-full px-4">
              {t(`state.${s}`)}
              <span className="ml-1 text-muted-foreground text-xs tabular-nums">
                {byState(s).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        <Button
          className="ml-auto h-11 rounded-full"
          onClick={() => setEditing(null)}
        >
          <Plus className="size-4" /> {t("create")}
        </Button>
      </div>
      {TABS.map((s) => (
        <TabsContent key={s} value={s}>
          {promos.isPending ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </div>
          ) : byState(s).length === 0 ? (
            <EmptyState icon={BadgePercent} title={t("empty")} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {byState(s).map((p) => (
                <PromotionCard
                  key={p.id}
                  promotion={p}
                  productNames={(products.data ?? [])
                    .filter((x) => p.productIds.includes(x.id))
                    .map((x) => x.name)}
                  categoryNames={(categories.data ?? [])
                    .filter((x) => p.categoryIds.includes(x.id))
                    .map((x) => x.name)}
                  onEdit={() => setEditing(p)}
                  onToggle={(isActive) => toggle.mutate({ id: p.id, isActive })}
                  onDelete={() => remove.mutate(p.id)}
                />
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
      {editing !== undefined && (
        <PromotionSheet
          orgId={orgId}
          promotion={editing}
          products={products.data ?? []}
          categories={categories.data ?? []}
          onClose={() => setEditing(undefined)}
        />
      )}
    </Tabs>
  );
}

function PromotionCard({
  promotion: p,
  productNames,
  categoryNames,
  onEdit,
  onToggle,
  onDelete,
}: {
  promotion: PromotionDTO;
  productNames: string[];
  categoryNames: string[];
  onEdit: () => void;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("promotions");
  const { dateTime } = useDateTime();
  const targets = [...categoryNames, ...productNames];
  return (
    <li className="grid gap-3 rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{p.name}</p>
        <Switch
          checked={p.isActive}
          onCheckedChange={onToggle}
          aria-label={t("active")}
        />
      </div>
      <PromotionPreview
        values={{
          discountType: p.discountType,
          discountValue: p.discountValue,
          minimumType: p.minimumType,
          minimumQuantity: String(p.minimumQuantity),
          minimumAmount: p.minimumAmount ?? "",
        }}
      />
      <p className="flex items-center gap-2 text-muted-foreground text-xs">
        <CalendarRange className="size-3.5" aria-hidden />
        {dateTime(p.startAt)} – {dateTime(p.endAt)}
      </p>
      <div className="flex flex-wrap gap-1">
        {targets.slice(0, 6).map((name) => (
          <Badge key={name} variant="secondary" className="rounded-full">
            {name}
          </Badge>
        ))}
        {targets.length > 6 && (
          <Badge variant="outline" className="rounded-full">
            +{targets.length - 6}
          </Badge>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {t("usage", { count: p.usageCount })}
        </span>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full"
            aria-label={t("edit")}
            onClick={onEdit}
          >
            <Pencil className="size-4" />
          </Button>
          <ConfirmDialog
            title={t("deleteTitle", { name: p.name })}
            description={t("deleteDescription")}
            confirmLabel={t("delete")}
            destructive
            onConfirm={onDelete}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full text-destructive"
              aria-label={t("delete")}
            >
              <Trash2 className="size-4" />
            </Button>
          </ConfirmDialog>
        </div>
      </div>
    </li>
  );
}
