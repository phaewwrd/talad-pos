"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiError, unwrap } from "@/lib/api/client";
import { useErrorMessage } from "@/lib/use-error-message";
import { cn } from "@/lib/utils";
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
} from "../actions";
import { catalogKeys, useCategories } from "../hooks";
import type { CategoryDTO } from "../types";

export function CategoriesManager({
  orgId,
  canEdit,
}: {
  orgId: string;
  canEdit: boolean;
}) {
  const t = useTranslations("products");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const categories = useCategories(orgId);
  const [items, setItems] = useState<CategoryDTO[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    if (categories.data) setItems(categories.data);
  }, [categories.data]);

  const key = catalogKeys.categories(orgId);
  const onError = (err: ApiError) =>
    toast.error(errorMessage(err.code, err.details));
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: catalogKeys.products(orgId) });
  };

  const create = useMutation({
    mutationFn: async (name: string) => unwrap(await createCategory({ name })),
    onSuccess: () => {
      setNewName("");
      invalidate();
    },
    onError,
  });
  const rename = useMutation({
    mutationFn: async (v: { id: string; name: string }) =>
      unwrap(await updateCategory(v.id, { name: v.name })),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await deleteCategory(id)),
    onSuccess: invalidate,
    onError,
  });
  const reorder = useMutation({
    mutationFn: async (ids: string[]) =>
      unwrap(await reorderCategories({ ids })),
    onMutate: async (ids) => {
      // Optimistic: keep the new order while the server catches up.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CategoryDTO[]>(key);
      if (previous) {
        const byId = new Map(previous.map((c) => [c.id, c]));
        queryClient.setQueryData(
          key,
          ids.flatMap((id, orderNo) => {
            const c = byId.get(id);
            return c ? [{ ...c, orderNo }] : [];
          }),
        );
      }
      return { previous };
    },
    onError: (err: ApiError, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      onError(err);
    },
    onSettled: invalidate,
  });

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    reorder.mutate(next.map((c) => c.id));
  }

  if (categories.isPending) {
    return (
      <div className="grid gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid max-w-2xl gap-4">
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) create.mutate(newName.trim());
          }}
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("newCategoryPlaceholder")}
            aria-label={t("newCategoryPlaceholder")}
            className="h-11 rounded-full"
            maxLength={60}
          />
          <Button
            type="submit"
            className="h-11 rounded-full"
            disabled={create.isPending || !newName.trim()}
          >
            <Plus className="size-4" /> {t("addCategory")}
          </Button>
        </form>
      )}

      {items.length === 0 ? (
        <EmptyState title={t("noCategories")} />
      ) : (
        <ul className="grid gap-2">
          {items.map((c, index) => (
            <li
              key={c.id}
              draggable={canEdit && editingId !== c.id}
              onDragStart={() => setDragId(c.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = items.findIndex((i) => i.id === dragId);
                if (from >= 0) move(from, index);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              className={cn(
                "flex min-h-14 items-center gap-2 rounded-2xl border bg-card px-3 shadow-card",
                dragId === c.id && "opacity-50",
              )}
            >
              {canEdit && (
                <GripVertical
                  className="size-4 shrink-0 cursor-grab text-muted-foreground"
                  aria-hidden
                />
              )}
              {editingId === c.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editName.trim())
                      rename.mutate({ id: c.id, name: editName.trim() });
                  }}
                >
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label={t("categoryName")}
                    className="h-10 rounded-xl"
                    maxLength={60}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="size-10 rounded-full"
                    aria-label={t("save")}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 rounded-full"
                    aria-label={t("cancel")}
                    onClick={() => setEditingId(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 truncate font-medium">{c.name}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {t("productCount", { count: c.productCount })}
                  </span>
                  {canEdit && (
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full"
                        aria-label={t("moveUp")}
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full"
                        aria-label={t("moveDown")}
                        disabled={index === items.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full"
                        aria-label={t("renameCategory")}
                        onClick={() => {
                          setEditingId(c.id);
                          setEditName(c.name);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDialog
                        title={t("deleteCategoryTitle", { name: c.name })}
                        description={
                          c.productCount > 0
                            ? t("deleteCategoryInUse")
                            : undefined
                        }
                        confirmLabel={t("delete")}
                        destructive
                        disabled={c.productCount > 0}
                        onConfirm={() => remove.mutate(c.id)}
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
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
