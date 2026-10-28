"use client";

import { cn } from "@/lib/utils";

/** "7 / 10" with a bar; amber from 80%, red at or over the limit. */
export function UsageMeter({
  used,
  limit,
  className,
}: {
  used: number;
  limit: number | null;
  className?: string;
}) {
  const ratio = limit ? used / limit : 0;
  const tone =
    limit === null
      ? "bg-success"
      : ratio >= 1
        ? "bg-primary"
        : ratio >= 0.8
          ? "bg-warning"
          : "bg-success";
  return (
    <div className={cn("grid min-w-20 gap-1", className)}>
      <span className="text-xs tabular-nums">
        {used} / {limit === null ? "∞" : limit}
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className={cn("block h-full rounded-full", tone)}
          style={{
            width: `${limit === null ? 100 : Math.min(100, ratio * 100)}%`,
          }}
        />
      </span>
    </div>
  );
}
