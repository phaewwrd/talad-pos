"use client";

import { useMutation } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { createOrder } from "@/features/orders/actions";
import { PaymentDialog } from "@/features/orders/components/payment-dialog";
import type { PaymentInput } from "@/features/orders/schemas";
import { useInvalidateOrders } from "@/features/orders/use-order-mutations";
import { useMediaQuery } from "@/hooks/use-media-query";
import { type ApiError, unwrap } from "@/lib/api/client";
import { useMoney } from "@/lib/format";
import { useErrorMessage } from "@/lib/use-error-message";
import { usePosBootstrap } from "../hooks";
import { useCart } from "../use-cart";
import { ActiveOrdersStrip } from "./active-orders-strip";
import { ChannelTabs } from "./channel-tabs";
import { MenuSection } from "./menu-section";
import { OrderSuccessDialog, type PlacedOrder } from "./order-success-dialog";
import { OrderSummary } from "./order-summary";

export function PosScreen({ orgId }: { orgId: string }) {
  const t = useTranslations("pos");
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidateOrders(orgId);
  const bootstrap = usePosBootstrap(orgId);
  const data = bootstrap.data;
  const cart = useCart(data);
  const [cartOpen, setCartOpen] = useState(false);
  const isTablet = useMediaQuery("(min-width: 768px)");
  const [paying, setPaying] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const place = useMutation({
    mutationFn: async (payment: PaymentInput | undefined) =>
      unwrap(
        await createOrder({
          salesChannel: cart.state.channel,
          customerName: cart.state.customerName.trim() || "Walk-in",
          items: cart.lines.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
          })),
          excludedPromotionIds: cart.state.excludedPromotionIds,
          payment,
        }),
      ),
    onSuccess: (order) => {
      setPaying(false);
      setCartOpen(false);
      cart.dispatch({ type: "reset" });
      setPlaced(order);
      invalidate();
    },
    onError: (err: ApiError) => {
      toast.error(errorMessage(err.code, err.details));
      // Stock or prices may have changed under us.
      invalidate();
    },
  });

  function onPlaceOrder() {
    if (cart.state.paid) setPaying(true);
    else place.mutate(undefined);
  }

  const summary = (
    <OrderSummary
      data={data}
      cart={cart}
      onPlaceOrder={onPlaceOrder}
      placing={place.isPending}
    />
  );

  return (
    <div className="xl:-mr-6 xl:grid xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid min-w-0 content-start gap-5 xl:pr-6">
        <ChannelTabs
          value={cart.state.channel}
          onChange={(channel) => cart.dispatch({ type: "channel", channel })}
          platformChannels={data?.platformChannels ?? false}
        />
        <ActiveOrdersStrip orgId={orgId} />
        <MenuSection data={data} cart={cart} loading={bootstrap.isPending} />
      </div>

      {/* Desktop ≥1280: fixed right panel */}
      <aside
        aria-label={t("orderSummary")}
        className="sticky top-16 hidden h-[calc(100dvh-4rem)] border-l bg-card p-5 xl:block"
      >
        {summary}
      </aside>

      {/* Tablet & mobile: floating cart button */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed right-4 bottom-20 z-30 flex h-14 items-center gap-3 rounded-full bg-primary pr-5 pl-4 font-semibold text-white shadow-lg md:bottom-6 xl:hidden"
        aria-label={t("openCart", { count: cart.itemCount })}
      >
        <span className="relative">
          <ShoppingCart className="size-5" aria-hidden />
          {cart.itemCount > 0 && (
            <span className="-top-2 -right-2 absolute flex size-5 items-center justify-center rounded-full bg-gold font-bold text-[11px] text-black">
              {cart.itemCount}
            </span>
          )}
        </span>
        <span className="tabular-nums">{money(cart.preview?.total ?? 0)}</span>
      </button>

      {isTablet ? (
        // Tablet: right drawer
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetContent
            side="right"
            className="w-[420px] max-w-full p-5 xl:hidden"
          >
            <SheetTitle className="sr-only">{t("orderSummary")}</SheetTitle>
            <SheetDescription className="sr-only">
              {t("orderSummary")}
            </SheetDescription>
            {summary}
          </SheetContent>
        </Sheet>
      ) : (
        // Mobile: bottom sheet
        <Drawer open={cartOpen} onOpenChange={setCartOpen}>
          <DrawerContent className="h-[92dvh] px-4 pb-4">
            <DrawerTitle className="sr-only">{t("orderSummary")}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {t("orderSummary")}
            </DrawerDescription>
            <div className="min-h-0 flex-1 pt-2">{summary}</div>
          </DrawerContent>
        </Drawer>
      )}

      <PaymentDialog
        open={paying}
        onOpenChange={setPaying}
        total={cart.preview?.total ?? "0.00"}
        promptpayId={data?.pricing.promptpayId ?? null}
        pending={place.isPending}
        onConfirm={(payment) => place.mutate(payment)}
      />
      <OrderSuccessDialog order={placed} onClose={() => setPlaced(null)} />
    </div>
  );
}
