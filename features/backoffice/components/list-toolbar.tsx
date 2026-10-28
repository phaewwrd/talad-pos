"use client";

import { Download, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { ServerTableState } from "@/components/data-table/server-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function useTableState(sortId: string, desc = true) {
  return useState<ServerTableState>({
    pagination: { pageIndex: 0, pageSize: 20 },
    sorting: [{ id: sortId, desc }],
  });
}

export function ListToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-3 shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SearchFilter({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const t = useTranslations("common");
  return (
    <div className="relative min-w-48 flex-1">
      <Search
        className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={t("search")}
        className="h-10 rounded-full pl-9"
      />
    </div>
  );
}

const ALL = "__all";

export function SelectFilter<V extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: V | "";
  onChange: (v: V | "") => void;
  options: { value: V; label: string }[];
  className?: string;
}) {
  const tc = useTranslations("common");
  return (
    <Select
      value={value || ALL}
      onValueChange={(v) => onChange(v === ALL ? "" : (v as V))}
    >
      <SelectTrigger
        aria-label={label}
        className={cn("h-10 min-w-36 rounded-full", className)}
      >
        <span className="text-muted-foreground text-xs">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{tc("all")}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DateRangeFilter({
  from,
  to,
  onChange,
  label,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  label: string;
}) {
  const tb = useTranslations("backoffice.table");
  const id = useId();
  return (
    <fieldset className="flex items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <label htmlFor={`${id}-from`} className="sr-only">
        {tb("from")}
      </label>
      <Input
        id={`${id}-from`}
        type="date"
        value={from}
        max={to || undefined}
        onChange={(e) => onChange({ from: e.target.value, to })}
        className="h-10 w-36 rounded-full"
      />
      <span aria-hidden className="text-muted-foreground">
        –
      </span>
      <label htmlFor={`${id}-to`} className="sr-only">
        {tb("to")}
      </label>
      <Input
        id={`${id}-to`}
        type="date"
        value={to}
        min={from || undefined}
        onChange={(e) => onChange({ from, to: e.target.value })}
        className="h-10 w-36 rounded-full"
      />
      {(from || to) && (
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full"
          onClick={() => onChange({ from: "", to: "" })}
          aria-label={tb("clearDates")}
        >
          <X className="size-4" />
        </Button>
      )}
    </fieldset>
  );
}

/** Link to a CSV route with the current filters. */
export function ExportCsvButton({
  href,
  params,
}: {
  href: string;
  params: Record<string, string | number | boolean | undefined | null>;
}) {
  const tb = useTranslations("backoffice.table");
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  }
  return (
    <Button asChild variant="outline" className="h-10 rounded-full">
      <a href={`${href}?${search}`} download>
        <Download className="size-4" /> {tb("exportCsv")}
      </a>
    </Button>
  );
}
