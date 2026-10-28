import type { StockAdjustmentType } from "@/db/app-schema";

export type StockLotDTO = {
  id: string;
  lotNumber: string;
  stockInDate: string;
  expiryDate: string | null;
  initialQuantity: number;
  remainingQuantity: number;
  /** Omitted for cashiers. */
  cost?: string;
  expiringSoon: boolean;
  expired: boolean;
};

export type StockProductDTO = {
  id: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  categoryName: string;
  stockQuantity: number;
  minimumStock: number;
  isActive: boolean;
  lots: StockLotDTO[];
};

export type StockOverviewDTO = {
  totalSkus: number;
  lowStock: number;
  outOfStock: number;
  expiringSoon: number;
  expiryAlertDays: number;
};

export type StockMovementDTO = {
  id: string;
  createdAt: string;
  productName: string;
  lotNumber: string | null;
  type: StockAdjustmentType;
  quantity: number;
  reason: string | null;
  actorName: string | null;
};
