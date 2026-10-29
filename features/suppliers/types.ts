import type { SupplierDisplayMode } from "@/db/schema";

export type StockStatus = "in" | "low" | "out";

/** One row on the public page. Keyed by SKU: no internal ids leave the server. */
export type PublicStockItem = {
  sku: string;
  name: string;
  imageUrl: string | null;
  status: StockStatus;
  /** null in STATUS display mode. */
  quantity: number | null;
};

export type PublicStock = {
  version: number;
  shopName: string;
  supplierName: string;
  items: PublicStockItem[];
};

export type SupplierLinkDTO = {
  token: string;
  isEnabled: boolean;
  hasPin: boolean;
  displayMode: SupplierDisplayMode;
  lowStockThreshold: number | null;
  viewCount: number;
  lastViewedAt: string | null;
};

export type SupplierDTO = {
  id: string;
  name: string;
  contact: string | null;
  productIds: string[];
  link: SupplierLinkDTO;
};

export type SupplierProductOptionDTO = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  isActive: boolean;
};

export type SuppliersBundle = {
  suppliers: SupplierDTO[];
  products: SupplierProductOptionDTO[];
};
