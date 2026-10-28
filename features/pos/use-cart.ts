"use client";

import { useMemo, useReducer } from "react";
import type { SalesChannel } from "@/db/app-schema";
import type { PosBootstrapDTO } from "@/features/orders/types";
import { calculateOrder } from "@/lib/pricing/calculate-order";
import type { PromotionRule } from "@/lib/promotions/apply";

export type CartState = {
  quantities: Record<string, number>;
  /** Insertion order for display. */
  order: string[];
  customerName: string;
  channel: SalesChannel;
  excludedPromotionIds: string[];
  paid: boolean;
};

type Action =
  | { type: "add"; productId: string; max: number }
  | { type: "set"; productId: string; quantity: number; max: number }
  | { type: "remove"; productId: string }
  | { type: "customer"; name: string }
  | { type: "channel"; channel: SalesChannel }
  | { type: "togglePromotion"; promotionId: string }
  | { type: "paid"; paid: boolean }
  | { type: "reset" };

const initial: CartState = {
  quantities: {},
  order: [],
  customerName: "",
  channel: "storefront",
  excludedPromotionIds: [],
  paid: true,
};

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case "add": {
      const current = state.quantities[action.productId] ?? 0;
      if (current >= action.max) return state;
      return {
        ...state,
        quantities: { ...state.quantities, [action.productId]: current + 1 },
        order: current === 0 ? [...state.order, action.productId] : state.order,
      };
    }
    case "set": {
      const quantity = Math.min(
        Math.max(0, Math.floor(action.quantity)),
        action.max,
      );
      if (quantity === 0)
        return reducer(state, { type: "remove", productId: action.productId });
      return {
        ...state,
        quantities: { ...state.quantities, [action.productId]: quantity },
        order: state.order.includes(action.productId)
          ? state.order
          : [...state.order, action.productId],
      };
    }
    case "remove": {
      const { [action.productId]: _removed, ...rest } = state.quantities;
      return {
        ...state,
        quantities: rest,
        order: state.order.filter((id) => id !== action.productId),
      };
    }
    case "customer":
      return { ...state, customerName: action.name };
    case "channel":
      return { ...state, channel: action.channel };
    case "togglePromotion":
      return {
        ...state,
        excludedPromotionIds: state.excludedPromotionIds.includes(
          action.promotionId,
        )
          ? state.excludedPromotionIds.filter((id) => id !== action.promotionId)
          : [...state.excludedPromotionIds, action.promotionId],
      };
    case "paid":
      return { ...state, paid: action.paid };
    case "reset":
      // Keep the channel: cashiers usually stay on the same tab.
      return { ...initial, channel: state.channel };
  }
}

export function toPromotionRules(
  data: PosBootstrapDTO | undefined,
): PromotionRule[] {
  return (data?.promotions ?? []).map((p) => ({
    ...p,
    startAt: new Date(p.startAt),
    endAt: new Date(p.endAt),
  }));
}

export function useCart(data: PosBootstrapDTO | undefined) {
  const [state, dispatch] = useReducer(reducer, initial);
  const rules = useMemo(() => toPromotionRules(data), [data]);

  const productsById = useMemo(
    () => new Map((data?.products ?? []).map((p) => [p.id, p])),
    [data?.products],
  );

  const lines = useMemo(
    () =>
      state.order.flatMap((id) => {
        const p = productsById.get(id);
        const quantity = state.quantities[id];
        return p && quantity ? [{ product: p, quantity }] : [];
      }),
    [state.order, state.quantities, productsById],
  );

  // Preview only — the server recomputes everything when the order is placed.
  const preview = useMemo(() => {
    if (!data || lines.length === 0) return null;
    return calculateOrder({
      lines: lines.map(({ product, quantity }) => ({
        productId: product.id,
        categoryId: product.categoryId,
        productName: product.name,
        unitPrice: product.price,
        quantity,
      })),
      promotions: rules,
      excludedPromotionIds: state.excludedPromotionIds,
      serviceCharge: data.pricing.serviceCharge,
      vat: data.pricing.vat,
      now: new Date(),
    });
  }, [data, lines, rules, state.excludedPromotionIds]);

  // Promotions that would apply if not removed (so the cashier can re-add them).
  const removablePromotions = useMemo(() => {
    if (!data || lines.length === 0 || state.excludedPromotionIds.length === 0)
      return [];
    return rules.filter((r) => state.excludedPromotionIds.includes(r.id));
  }, [data, lines.length, rules, state.excludedPromotionIds]);

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);

  return {
    state,
    dispatch,
    lines,
    preview,
    rules,
    removablePromotions,
    itemCount,
  };
}

export type Cart = ReturnType<typeof useCart>;
