"use client";

import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProductThumb } from "@/components/common/product-thumb";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { SalesChannel } from "@/db/app-schema";
import { usePosBootstrap } from "@/features/pos/hooks";
import { useMoney } from "@/lib/format";
import { useOrder } from "../hooks";
import { SALES_CHANNELS } from "../schemas";
import { useOrderMutations } from "../use-order-mutations";

type Line = {
  productId: string;
  name: string;
  imageUrl: string | null;
  unitPrice: string;
  quantity: number;
};

export function EditOrderSheet({
  orgId,
  orderId,
  needsReason,
  onClose,
}: {
  orgId: string;
  orderId: string;
  needsReason: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("orders");
  const tc = useTranslations("channels");
  const money = useMoney();
  const order = useOrder(orgId, orderId);
  const pos = usePosBootstrap(orgId);
  const { update } = useOrderMutations(orgId);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [channel, setChannel] = useState<SalesChannel>("storefront");
  const [reason, setReason] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!order.data || lines) return;
    setLines(
      order.data.items.map((i) => ({
        productId: i.productId,
        name: i.productName,
        imageUrl: i.imageUrl,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      })),
    );
    setCustomerName(order.data.customerName);
    setChannel(order.data.salesChannel);
  }, [order.data, lines]);

  const addable = useMemo(
    () =>
      (pos.data?.products ?? []).filter(
        (p) => !lines?.some((l) => l.productId === p.id),
      ),
    [pos.data?.products, lines],
  );

  const setQty = (productId: string, quantity: number) =>
    setLines((ls) =>
      (ls ?? []).flatMap((l) =>
        l.productId !== productId
          ? [l]
          : quantity > 0
            ? [{ ...l, quantity }]
            : [],
      ),
    );

  const canSave =
    lines && lines.length > 0 && (!needsReason || reason.trim().length > 0);

  function save() {
    if (!lines) return;
    update.mutate(
      {
        orderId,
        customerName: customerName.trim() || "Walk-in",
        salesChannel: channel,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
        // TODO(decision): promotions removed at sale time aren't stored, so an
        // edit re-runs the best-for-customer promotion selection.
        excludedPromotionIds: [],
        reason: reason.trim() || undefined,
      },
      {
        onSuccess: (r) => {
          toast.success(t("updated", { total: money(r.total) }));
          onClose();
        },
      },
    );
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {t("editOrder")} {order.data?.orderNumber}
          </SheetTitle>
          <SheetDescription>{t("editDescription")}</SheetDescription>
        </SheetHeader>
        {!lines ? (
          <div className="grid gap-2 px-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 px-4 pb-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-customer">{t("customer")}</Label>
                <Input
                  id="edit-customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  maxLength={80}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-channel">{t("channel")}</Label>
                <Select
                  value={channel}
                  onValueChange={(v) => setChannel(v as SalesChannel)}
                >
                  <SelectTrigger
                    id="edit-channel"
                    className="h-11 w-full rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SALES_CHANNELS.filter(
                      (c) =>
                        c === "storefront" ||
                        pos.data?.platformChannels ||
                        c === channel,
                    ).map((c) => (
                      <SelectItem key={c} value={c}>
                        {tc(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ul className="grid gap-2">
              {lines.map((l) => (
                <li
                  key={l.productId}
                  className="flex items-center gap-3 rounded-2xl border p-2"
                >
                  <ProductThumb src={l.imageUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{l.name}</p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {money(l.unitPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                      aria-label={t("decrease")}
                      onClick={() => setQty(l.productId, l.quantity - 1)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-8 text-center font-semibold tabular-nums">
                      {l.quantity}
                    </span>
                    <Button
                      size="icon"
                      className="size-9 rounded-full"
                      aria-label={t("increase")}
                      onClick={() => setQty(l.productId, l.quantity + 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-full text-destructive"
                      aria-label={t("removeLine")}
                      onClick={() => setQty(l.productId, 0)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-11 rounded-full">
                  <Plus className="size-4" /> {t("addProduct")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder={t("searchProduct")} />
                  <CommandList>
                    <CommandEmpty>{t("noMatch")}</CommandEmpty>
                    <CommandGroup>
                      {addable.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.name} ${p.sku}`}
                          disabled={p.stockQuantity <= 0}
                          onSelect={() => {
                            setLines((ls) => [
                              ...(ls ?? []),
                              {
                                productId: p.id,
                                name: p.name,
                                imageUrl: p.imageUrl,
                                unitPrice: p.price,
                                quantity: 1,
                              },
                            ]);
                            setPickerOpen(false);
                          }}
                        >
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {money(p.price)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-reason">
                {t("reason")} {needsReason ? "*" : `(${t("optional")})`}
              </Label>
              <Textarea
                id="edit-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                className="rounded-xl"
              />
            </div>

            <Button
              className="h-12 rounded-full"
              disabled={!canSave || update.isPending}
              onClick={save}
            >
              {update.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("saveChanges")}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
