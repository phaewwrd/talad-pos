import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  loading,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "warning" | "danger" | "gold" | "success";
  loading?: boolean;
  hint?: React.ReactNode;
}) {
  const toneClass = {
    default: "bg-muted text-foreground",
    warning: "bg-warning/15 text-warning",
    danger: "bg-primary-soft text-primary",
    gold: "bg-gold-soft text-gold-text",
    success: "bg-success/15 text-success",
  }[tone];
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-card">
      {Icon && (
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            toneClass,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-muted-foreground text-sm">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-20" />
        ) : (
          <p className="font-semibold text-2xl tabular-nums">{value}</p>
        )}
        {hint && (
          <div className="mt-0.5 text-muted-foreground text-xs">{hint}</div>
        )}
      </div>
    </div>
  );
}
