"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "../hooks";
import {
  AccountForm,
  DevicesPanel,
  ShopsPanel,
  StaffPanel,
} from "./settings-panels";
import { ShopForm, TaxForm } from "./shop-forms";

const TABS = ["shop", "tax", "staff", "devices", "shops", "account"] as const;

export function SettingsView({ orgId }: { orgId: string }) {
  const t = useTranslations("settings.tabs");
  const { data, isPending } = useSettings(orgId);
  return (
    <Tabs defaultValue="shop">
      <div className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <TabsList className="h-11 w-max rounded-full p-1">
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="rounded-full px-4">
              {t(tab)}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {isPending || !data ? (
        <Skeleton className="h-96 max-w-2xl rounded-2xl" />
      ) : (
        <>
          <TabsContent value="shop">
            <ShopForm orgId={orgId} settings={data.settings} />
          </TabsContent>
          <TabsContent value="tax">
            <TaxForm orgId={orgId} settings={data.settings} />
          </TabsContent>
          <TabsContent value="staff">
            <StaffPanel orgId={orgId} data={data} />
          </TabsContent>
          <TabsContent value="devices">
            <DevicesPanel orgId={orgId} data={data} />
          </TabsContent>
          <TabsContent value="shops">
            <ShopsPanel data={data} />
          </TabsContent>
          <TabsContent value="account">
            <AccountForm />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}
