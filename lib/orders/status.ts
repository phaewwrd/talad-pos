import type { OrderStatus } from "@/db/app-schema";

export const STATUS_FLOW: readonly OrderStatus[] = [
  "Pending",
  "In Progress",
  "Ready",
  "Completed",
];
export const ACTIVE_STATUSES: readonly OrderStatus[] = [
  "Pending",
  "In Progress",
  "Ready",
];

export type TransitionKind =
  | "forward"
  | "backward"
  | "cancel"
  | "none"
  | "invalid";

/** Classify a status change. Cancelled is terminal (use delete/restore instead). */
export function classifyTransition(
  from: OrderStatus,
  to: OrderStatus,
): TransitionKind {
  if (from === to) return "none";
  if (from === "Cancelled") return "invalid";
  if (to === "Cancelled") return "cancel";
  return STATUS_FLOW.indexOf(to) > STATUS_FLOW.indexOf(from)
    ? "forward"
    : "backward";
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(status);
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
}
