import type { MemberRole } from "@/lib/roles";
import type { OrderListItemDTO } from "./types";

type Viewer = { role: MemberRole; userId: string };

/** UI mirror of the server rules in actions.ts (server stays authoritative). */
export const orderUi = {
  canEdit: (
    v: Viewer,
    o: Pick<
      OrderListItemDTO,
      "status" | "paymentType" | "staffId" | "deletedAt"
    >,
  ) =>
    !o.deletedAt &&
    o.status !== "Cancelled" &&
    (v.role !== "cashier" ||
      (o.staffId === v.userId &&
        o.paymentType === "Unpaid" &&
        o.status === "Pending")),
  editNeedsReason: (
    v: Viewer,
    o: Pick<OrderListItemDTO, "status" | "paymentType">,
  ) =>
    v.role === "manager" &&
    (o.paymentType === "Paid" || o.status !== "Pending"),
  canMoveBackward: (v: Viewer) => v.role !== "cashier",
  canCancelOrDelete: (v: Viewer) => v.role !== "cashier",
  canRestore: (v: Viewer) => v.role === "owner",
  canTakePayment: (
    o: Pick<OrderListItemDTO, "paymentType" | "status" | "deletedAt">,
  ) => !o.deletedAt && o.paymentType === "Unpaid" && o.status !== "Cancelled",
};
