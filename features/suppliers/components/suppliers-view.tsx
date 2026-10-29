"use client";

import {
  Copy,
  Eye,
  KeyRound,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  Truck,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { useAppForm } from "@/components/form/app-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { issuesToFields } from "@/features/settings/hooks";
import { useDateTime } from "@/lib/format";
import {
  createSupplier,
  deleteSupplier,
  regenerateLink,
  removeLinkPin,
  setLinkEnabled,
  setLinkPin,
  updateLinkDisplay,
  updateSupplier,
} from "../actions";
import { useSuppliers } from "../hooks";
import { DISPLAY_MODES, supplierSchema } from "../schemas";
import type { SupplierDTO, SuppliersBundle } from "../types";
import { useRun } from "../use-run";
import { PinDialog } from "./pin-dialog";
import { ProductsDialog } from "./products-dialog";

export function SuppliersView({ orgId }: { orgId: string }) {
  const t = useTranslations("suppliers");
  const { data, isPending } = useSuppliers(orgId);
  const [editing, setEditing] = useState<SupplierDTO | "new" | null>(null);

  return (
    <div className="grid max-w-3xl gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-sm">{t("intro")}</p>
        <Button
          className="ml-auto h-11 rounded-full"
          onClick={() => setEditing("new")}
        >
          <Plus className="size-4" /> {t("add")}
        </Button>
      </div>

      {isPending || !data ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : data.suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={t("empty")}
          description={t("emptyHint")}
        />
      ) : (
        <ul className="grid gap-3">
          {data.suppliers.map((s) => (
            <SupplierCard
              key={s.id}
              orgId={orgId}
              supplier={s}
              data={data}
              onEdit={() => setEditing(s)}
            />
          ))}
        </ul>
      )}

      <SupplierFormDialog
        // Remount per supplier so the form picks up its defaultValues.
        key={
          editing === null || editing === "new" ? String(editing) : editing.id
        }
        orgId={orgId}
        supplier={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function SupplierCard({
  orgId,
  supplier: s,
  data,
  onEdit,
}: {
  orgId: string;
  supplier: SupplierDTO;
  data: SuppliersBundle;
  onEdit: () => void;
}) {
  const t = useTranslations("suppliers");
  const locale = useLocale();
  const { dateTime } = useDateTime();
  const run = useRun(orgId);
  const [productsOpen, setProductsOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [threshold, setThreshold] = useState(
    s.link.lowStockThreshold?.toString() ?? "",
  );
  const link = s.link;
  const url =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/${locale}/s/${link.token}`;

  const saveDisplay = (
    displayMode: (typeof DISPLAY_MODES)[number],
    raw: string,
  ) => {
    const lowStockThreshold = raw.trim() === "" ? null : Number(raw);
    if (
      lowStockThreshold !== null &&
      (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0)
    ) {
      return void toast.error(t("thresholdInvalid"));
    }
    if (
      displayMode === link.displayMode &&
      lowStockThreshold === link.lowStockThreshold
    )
      return;
    run(
      updateLinkDisplay({ supplierId: s.id, displayMode, lowStockThreshold }),
      t("saved"),
    );
  };

  return (
    <li className="grid gap-4 rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{s.name}</p>
          {s.contact && (
            <p className="truncate text-muted-foreground text-sm">
              {s.contact}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          className="h-10 rounded-full"
          onClick={() => setProductsOpen(true)}
        >
          <Package className="size-4" />
          {t("productCount", { count: s.productIds.length })}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full"
              aria-label={t("more")}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="size-4" /> {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => setDeleting(true)}
            >
              <Trash2 className="size-4" /> {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-3 rounded-xl bg-muted/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Switch
            id={`link-${s.id}`}
            checked={link.isEnabled}
            onCheckedChange={(isEnabled) =>
              run(
                setLinkEnabled({ supplierId: s.id, isEnabled }),
                isEnabled ? t("linkEnabled") : t("linkDisabled"),
              )
            }
          />
          <Label htmlFor={`link-${s.id}`} className="font-medium">
            {t("stockLink")}
          </Label>
          <Badge
            variant="outline"
            className={
              link.isEnabled
                ? "rounded-full border-success/40 text-success"
                : "rounded-full"
            }
          >
            {link.isEnabled ? t("on") : t("off")}
          </Badge>
          {link.hasPin && (
            <Badge variant="outline" className="rounded-full">
              <KeyRound className="size-3" /> {t("pinOn")}
            </Badge>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground text-xs">
            <Eye className="size-3.5" aria-hidden />
            {t("views", { count: link.viewCount })}
            {link.lastViewedAt &&
              ` · ${t("lastViewed", { time: dateTime(link.lastViewedAt) })}`}
          </span>
        </div>

        <div className="flex gap-2">
          <Input
            readOnly
            value={url}
            aria-label={t("linkUrl")}
            onFocus={(e) => e.currentTarget.select()}
            className="h-10 min-w-0 flex-1 rounded-full bg-card font-mono text-xs"
          />
          <Button
            variant="outline"
            className="h-10 rounded-full"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              toast.success(t("copied"));
            }}
          >
            <Copy className="size-4" />
            <span className="sr-only sm:not-sr-only">{t("copy")}</span>
          </Button>
          <Button variant="outline" className="h-10 rounded-full" asChild>
            <a
              href={`https://line.me/R/share?text=${encodeURIComponent(
                t("shareText", { supplier: s.name, url }),
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Share2 className="size-4" />
              <span className="sr-only sm:not-sr-only">{t("shareLine")}</span>
            </a>
          </Button>
        </div>
        {!link.isEnabled && (
          <p className="text-muted-foreground text-xs">{t("disabledHint")}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`mode-${s.id}`}>{t("displayMode")}</Label>
            <Select
              value={link.displayMode}
              onValueChange={(v) =>
                saveDisplay(v as (typeof DISPLAY_MODES)[number], threshold)
              }
            >
              <SelectTrigger
                id={`mode-${s.id}`}
                className="h-10 w-full rounded-full bg-card"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISPLAY_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`modes.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`threshold-${s.id}`}>{t("lowThreshold")}</Label>
            <Input
              id={`threshold-${s.id}`}
              inputMode="numeric"
              value={threshold}
              placeholder={t("lowThresholdPlaceholder")}
              onChange={(e) => setThreshold(e.target.value.replace(/\D/g, ""))}
              onBlur={() => saveDisplay(link.displayMode, threshold)}
              className="h-10 rounded-full bg-card"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-full"
            onClick={() => setPinOpen(true)}
          >
            <KeyRound className="size-4" />
            {link.hasPin ? t("changePin") : t("setPin")}
          </Button>
          {link.hasPin && (
            <ConfirmDialog
              title={t("removePinTitle")}
              description={t("removePinDescription")}
              confirmLabel={t("removePin")}
              onConfirm={() =>
                run(removeLinkPin({ supplierId: s.id }), t("pinRemoved"))
              }
            >
              <Button variant="outline" className="h-10 rounded-full">
                {t("removePin")}
              </Button>
            </ConfirmDialog>
          )}
          <ConfirmDialog
            title={t("regenerateTitle")}
            description={t("regenerateDescription")}
            confirmLabel={t("regenerate")}
            destructive
            onConfirm={() =>
              run(regenerateLink({ supplierId: s.id }), t("regenerated"))
            }
          >
            <Button
              variant="outline"
              className="h-10 rounded-full text-destructive"
            >
              <RefreshCw className="size-4" /> {t("regenerate")}
            </Button>
          </ConfirmDialog>
        </div>
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("deleteTitle", { name: s.name })}
        description={t("deleteDescription")}
        confirmLabel={t("delete")}
        destructive
        onConfirm={() =>
          run(deleteSupplier({ supplierId: s.id }), t("deleted"))
        }
      />
      <ProductsDialog
        orgId={orgId}
        open={productsOpen}
        onOpenChange={setProductsOpen}
        supplier={s}
        products={data.products}
      />
      <PinDialog
        orgId={orgId}
        open={pinOpen}
        onOpenChange={setPinOpen}
        supplier={s}
        onSave={(pin) => setLinkPin({ supplierId: s.id, pin })}
      />
    </li>
  );
}

function SupplierFormDialog({
  orgId,
  supplier,
  onClose,
}: {
  orgId: string;
  supplier: SupplierDTO | "new" | null;
  onClose: () => void;
}) {
  const t = useTranslations("suppliers");
  const run = useRun(orgId);
  const editing = supplier !== null && supplier !== "new" ? supplier : null;
  const form = useAppForm({
    defaultValues: {
      name: editing?.name ?? "",
      contact: editing?.contact ?? "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const r = supplierSchema.safeParse(value);
        return r.success ? undefined : issuesToFields(r.error.issues);
      },
    },
    onSubmit: async ({ value }) => {
      const ok = editing
        ? await run(
            updateSupplier({ supplierId: editing.id, ...value }),
            t("saved"),
          )
        : await run(createSupplier(value), t("created"));
      if (ok) onClose();
    },
  });

  return (
    <Dialog
      open={supplier !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("edit") : t("add")}</DialogTitle>
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
            {(f) => <f.TextField label={t("name")} maxLength={80} />}
          </form.AppField>
          <form.AppField name="contact">
            {(f) => (
              <f.TextField
                label={t("contact")}
                hint={t("contactHint")}
                maxLength={200}
              />
            )}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton>
              {editing ? t("save") : t("add")}
            </form.SubmitButton>
          </form.AppForm>
        </form>
      </DialogContent>
    </Dialog>
  );
}
