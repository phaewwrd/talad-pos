"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MemberRole } from "@/lib/roles";
import { CategoriesManager } from "./categories-manager";
import { ProductsTable } from "./products-table";

export function ProductsView({
  orgId,
  role,
}: {
  orgId: string;
  role: MemberRole;
}) {
  const t = useTranslations("products");
  return (
    <Tabs defaultValue="products">
      <TabsList className="mb-4 h-11 rounded-full p-1">
        <TabsTrigger value="products" className="rounded-full px-4">
          {t("tabProducts")}
        </TabsTrigger>
        <TabsTrigger value="categories" className="rounded-full px-4">
          {t("tabCategories")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="products">
        <ProductsTable orgId={orgId} role={role} />
      </TabsContent>
      <TabsContent value="categories">
        <CategoriesManager orgId={orgId} canEdit={role !== "cashier"} />
      </TabsContent>
    </Tabs>
  );
}
