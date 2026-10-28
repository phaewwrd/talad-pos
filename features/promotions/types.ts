export type PromotionState = "active" | "scheduled" | "expired" | "inactive";

export type PromotionDTO = {
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
  state: PromotionState;
  usageCount: number;
};
