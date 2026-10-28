import type {
  OrderAuditAction,
  OrderStatus,
  PaymentMethod,
  PaymentType,
  SalesChannel,
  VatMode,
} from "@/db/app-schema";
import type { CategoryDTO, ProductDTO } from "@/features/catalog/types";

export type OrderListItemDTO = {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  itemCount: number;
  total: string;
  status: OrderStatus;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod | null;
  salesChannel: SalesChannel;
  staffId: string | null;
  staffName: string | null;
  deletedAt: string | null;
  deleteReason: string | null;
};

export type OrderDetailDTO = OrderListItemDTO & {
  subtotal: string;
  discountTotal: string;
  serviceChargeRate: string;
  serviceChargeAmount: string;
  vatMode: VatMode;
  vatRate: string;
  vatAmount: string;
  cashReceived: string | null;
  changeAmount: string | null;
  paidAt: string | null;
  deletedByName: string | null;
  items: {
    id: string;
    productId: string;
    productName: string;
    categoryId: string | null;
    imageUrl: string | null;
    quantity: number;
    unitPrice: string;
    discountAmount: string;
    lineTotal: string;
    /** Owner/manager only. */
    allocations?: { lotNumber: string; quantity: number; cost?: string }[];
  }[];
  promotions: {
    promotionId: string | null;
    promotionName: string;
    discountAmount: string;
    matchedQuantity: number;
  }[];
  audit: {
    id: string;
    action: OrderAuditAction;
    actorName: string | null;
    reason: string | null;
    createdAt: string;
    before: unknown;
    after: unknown;
  }[];
};

export type PosBootstrapDTO = {
  products: ProductDTO[];
  categories: CategoryDTO[];
  promotions: {
    id: string;
    name: string;
    discountType: "percentage" | "fixed";
    discountValue: string;
    minimumType: "quantity" | "amount";
    minimumQuantity: number;
    minimumAmount: string | null;
    startAt: string;
    endAt: string;
    isActive: boolean;
    productIds: string[];
    categoryIds: string[];
  }[];
  pricing: {
    serviceCharge: { enabled: boolean; rate: string };
    vat: { mode: VatMode; rate: string };
    promptpayId: string | null;
    orderNumberPrefix: string;
  };
  nextOrderNumber: string;
  platformChannels: boolean;
};
