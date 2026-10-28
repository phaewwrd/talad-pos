"use client";

import { ChevronRight, ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderMutations } from "@/features/orders/use-order-mutations";
import { Link } from "@/i18n/navigation";
import { useDateTime, useMoney } from "@/lib/format";
import { nextStatus } from "@/lib/orders/status";
import { useActiveOrders } from "../hooks";

export function ActiveOrdersStrip({ orgId }: { orgId: string }) {
  const t = useTranslations("pos");
  const ts = useTranslations("orderStatus");
  const money = useMoney();
  const { time } = useDateTime();
  const active = useActiveOrders(orgId);
  const { status } = useOrderMutations(orgId);
  const list = active.data ?? [];

  return (
    <section aria-labelledby="active-orders" className="grid gap-2">
      <h2 id="active-orders" className="flex items-center gap-2 font-semibold">
        {t("activeOrders")}
        <span className="rounded-full bg-gold-soft px-2 text-gold-text text-xs tabular-nums">
          {list.length}
        </span>
      </h2>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-3 pb-1">
          {active.isPending &&
            [0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-24 w-48 rounded-2xl" />
              </li>
            ))}
          {!active.isPending && list.length === 0 && (
            <li className="flex h-24 w-64 items-center gap-2 rounded-2xl border border-dashed bg-card px-4 text-muted-foreground text-sm">
              <ClipboardList className="size-4" aria-hidden />{" "}
              {t("noActiveOrders")}
            </li>
          )}
          {list.map((o) => {
            const next = nextStatus(o.status);
            return (
              <li key={o.id}>
                <Popover>
                  <PopoverTrigger className="flex h-24 w-48 flex-col justify-between rounded-2xl border bg-card p-3 text-left shadow-card hover:border-primary">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-sm">
                        {o.orderNumber}
                      </span>
                      <StatusPill status={o.status} />
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t("itemCount", { count: o.itemCount })} ·{" "}
                      {time(o.createdAt)}
                    </span>
                    <span className="flex items-center justify-between text-xs">
                      <span className="truncate">{o.customerName}</span>
                      <span className="font-semibold text-gold-text tabular-nums">
                        {money(o.total)}
                      </span>
                    </span>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 rounded-2xl" align="start">
                    <div className="grid gap-2">
                      <p className="font-semibold">{o.orderNumber}</p>
                      {next && (
                        <Button
                          className="h-11 rounded-full"
                          disabled={status.isPending}
                          onClick={() =>
                            status.mutate({ orderId: o.id, status: next })
                          }
                        >
                          {t("markAs", { status: ts(next) })}
                        </Button>
                      )}
                      {o.status !== "Completed" && next !== "Completed" && (
                        <Button
                          variant="outline"
                          className="h-11 rounded-full"
                          disabled={status.isPending}
                          onClick={() =>
                            status.mutate({
                              orderId: o.id,
                              status: "Completed",
                            })
                          }
                        >
                          {t("markAs", { status: ts("Completed") })}
                        </Button>
                      )}
                      <Button
                        asChild
                        variant="ghost"
                        className="h-11 rounded-full"
                      >
                        <Link href={`/orders/${o.id}`}>
                          {t("viewOrder")} <ChevronRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
