import {
  BadgePercent,
  Boxes,
  ChartColumn,
  Coins,
  type LucideIcon,
  Package,
  ReceiptText,
  Settings,
  Store,
  Truck,
} from "lucide-react";
import type { MemberRole } from "@/lib/roles";

export type NavKey =
  | "pos"
  | "orders"
  | "products"
  | "stock"
  | "suppliers"
  | "promotions"
  | "sales"
  | "costProfit"
  | "settings";

export type NavItem = {
  key: NavKey;
  href: `/${string}`;
  icon: LucideIcon;
  roles: readonly MemberRole[];
  /** Shown in the mobile bottom tab bar (others go into "More"). */
  primary?: boolean;
};

const everyone = ["owner", "manager", "cashier"] as const;

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "pos", href: "/pos", icon: Store, roles: everyone, primary: true },
  {
    key: "orders",
    href: "/orders",
    icon: ReceiptText,
    roles: everyone,
    primary: true,
  },
  {
    key: "products",
    href: "/products",
    icon: Package,
    roles: everyone,
    primary: true,
  },
  { key: "stock", href: "/stock", icon: Boxes, roles: everyone },
  {
    key: "suppliers",
    href: "/suppliers",
    icon: Truck,
    roles: ["owner", "manager"],
  },
  {
    key: "promotions",
    href: "/promotions",
    icon: BadgePercent,
    roles: ["owner", "manager"],
  },
  {
    key: "sales",
    href: "/sales",
    icon: ChartColumn,
    roles: everyone,
    primary: true,
  },
  { key: "costProfit", href: "/cost-profit", icon: Coins, roles: ["owner"] },
  { key: "settings", href: "/settings", icon: Settings, roles: ["owner"] },
];

export function navItemsFor(role: MemberRole) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
