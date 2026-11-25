"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { OrderStatus } from "@/db/app-schema";
import { type ApiError, unwrap } from "@/lib/api/client";
import { useErrorMessage } from "@/lib/use-error-message";
import {
  changeOrderStatus,
  deleteOrder,
  restoreOrder,
  takePayment,
  updateOrder,
} from "./actions";
import type { PaymentInput, UpdateOrderInput } from "./schemas";
import type { OrderListItemDTO } from "./types";

/** Invalidate everything an order change can affect (lists, stock, POS, reports). */
export function useInvalidateOrders(orgId: string) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ["orders", "stock", "pos", "products", "sales"]) {
      queryClient.invalidateQueries({ queryKey: [key, orgId] });
    }
  };
}

export function useOrderMutations(orgId: string) {
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidateOrders(orgId);
  const onError = (err: ApiError) =>
    toast.error(errorMessage(err.code, err.details));

  const status = useMutation({
    mutationFn: async (v: {
      orderId: string;
      status: OrderStatus;
      reason?: string;
    }) => unwrap(await changeOrderStatus(v)),
    // Optimistic status update in every cached order list.
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: ["orders", orgId] });
      const snapshots = queryClient.getQueriesData<OrderListItemDTO[]>({
        queryKey: ["orders", orgId],
      });
      for (const [key, list] of snapshots) {
        if (Array.isArray(list)) {
          queryClient.setQueryData(
            key,
            list.map((o) =>
              o.id === v.orderId ? { ...o, status: v.status } : o,
            ),
          );
        }
      }
      return { snapshots };
    },
    onError: (err: ApiError, _v, context) => {
      for (const [key, data] of context?.snapshots ?? [])
        queryClient.setQueryData(key, data);
      onError(err);
    },
    onSettled: invalidate,
  });

  const payment = useMutation({
    mutationFn: async (v: { orderId: string; payment: PaymentInput }) =>
      unwrap(await takePayment(v)),
    onSuccess: invalidate,
    onError,
  });
  const update = useMutation({
    mutationFn: async (v: UpdateOrderInput) => unwrap(await updateOrder(v)),
    onSuccess: invalidate,
    onError,
  });
  const remove = useMutation({
    mutationFn: async (v: { orderId: string; reason: string }) =>
      unwrap(await deleteOrder(v)),
    onSuccess: invalidate,
    onError,
  });
  const restore = useMutation({
    mutationFn: async (orderId: string) =>
      unwrap(await restoreOrder({ orderId })),
    onSuccess: invalidate,
    onError,
  });

  return { status, payment, update, remove, restore };
}
