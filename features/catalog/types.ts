export type CategoryDTO = {
  id: string;
  name: string;
  orderNo: number;
  productCount: number;
};

export type ProductDTO = {
  id: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
  price: string;
  /** Omitted for cashiers. */
  cost?: string;
  stockQuantity: number;
  minimumStock: number;
  isActive: boolean;
};
