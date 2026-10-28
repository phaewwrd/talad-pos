"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  removeLabel,
}: {
  id?: string;
  options: { value: string; label: string; hint?: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  removeLabel: (label: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const toggle = (v: string) =>
    onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="grid gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-11 justify-between rounded-xl font-normal"
          >
            <span className="truncate text-muted-foreground">
              {value.length ? `${value.length} ✓` : placeholder}
            </span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-72 p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.hint ?? ""}`}
                    onSelect={() => toggle(o.value)}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        selected.has(o.value) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.hint && (
                      <span className="text-muted-foreground text-xs">
                        {o.hint}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {options
            .filter((o) => selected.has(o.value))
            .map((o) => (
              <Badge
                key={o.value}
                variant="secondary"
                className="gap-1 rounded-full pr-1"
              >
                {o.label}
                <button
                  type="button"
                  onClick={() => toggle(o.value)}
                  aria-label={removeLabel(o.label)}
                  className="flex size-5 items-center justify-center rounded-full hover:bg-background"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
        </div>
      )}
    </div>
  );
}
