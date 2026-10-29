"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicStock } from "./types";

export type LiveStockEvent =
  | { type: "update"; stock: PublicStock }
  | { type: "unchanged" }
  // Link disabled/regenerated, or the PIN changed (device must unlock again).
  | { type: "gone"; reason: "unavailable" | "locked" }
  | { type: "error" };

/**
 * How updates reach the page. Polling today; a push provider (Pusher, Ably…)
 * can implement the same interface and replace it without touching the UI.
 */
export type StockTransport = {
  subscribe(
    getVersion: () => number,
    emit: (event: LiveStockEvent) => void,
  ): () => void;
};

const POLL_MS = 10_000;

/** GET /api/s/[token]/stock?v= every 10s; paused while the tab is hidden. */
export function pollingTransport(token: string): StockTransport {
  return {
    subscribe(getVersion, emit) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let inFlight = false;
      let stopped = false;

      async function poll() {
        clearTimeout(timer);
        if (stopped || inFlight || document.hidden) return;
        inFlight = true;
        try {
          const res = await fetch(
            `/api/s/${encodeURIComponent(token)}/stock?v=${getVersion()}`,
            { cache: "no-store" },
          );
          if (res.status === 204) emit({ type: "unchanged" });
          else if (res.ok) emit({ type: "update", stock: await res.json() });
          else if (res.status === 404)
            return emit({ type: "gone", reason: "unavailable" });
          else if (res.status === 401)
            return emit({ type: "gone", reason: "locked" });
          else emit({ type: "error" });
        } catch {
          emit({ type: "error" });
        } finally {
          inFlight = false;
        }
        if (!stopped) timer = setTimeout(poll, POLL_MS);
      }

      const resume = () => {
        if (!document.hidden) poll();
      };
      document.addEventListener("visibilitychange", resume);
      window.addEventListener("focus", resume);
      window.addEventListener("online", resume);
      timer = setTimeout(poll, POLL_MS);
      return () => {
        stopped = true;
        clearTimeout(timer);
        document.removeEventListener("visibilitychange", resume);
        window.removeEventListener("focus", resume);
        window.removeEventListener("online", resume);
      };
    },
  };
}

const rowKey = (i: PublicStock["items"][number]) =>
  `${i.status}:${i.quantity ?? ""}`;

export function useLiveStock(initial: PublicStock, transport: StockTransport) {
  const [stock, setStock] = useState(initial);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const [connected, setConnected] = useState(true);
  const [gone, setGone] = useState<"unavailable" | "locked" | null>(null);
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());
  const stockRef = useRef(stock);
  stockRef.current = stock;

  useEffect(
    () =>
      transport.subscribe(
        () => stockRef.current.version,
        (event) => {
          if (event.type === "error") return setConnected(false);
          if (event.type === "gone") return setGone(event.reason);
          setConnected(true);
          setCheckedAt(Date.now());
          if (event.type !== "update") return;
          const before = new Map(
            stockRef.current.items.map((i) => [i.sku, rowKey(i)]),
          );
          setChanged(
            new Set(
              event.stock.items
                .filter((i) => before.get(i.sku) !== rowKey(i))
                .map((i) => i.sku),
            ),
          );
          setStock(event.stock);
        },
      ),
    [transport],
  );

  // Drop the highlight after the animation.
  useEffect(() => {
    if (changed.size === 0) return;
    const t = setTimeout(() => setChanged(new Set()), 2500);
    return () => clearTimeout(t);
  }, [changed]);

  return { stock, checkedAt, connected, gone, changed };
}
