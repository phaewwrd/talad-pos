"use client";

import { useId } from "react";
import { FieldError } from "@/components/form/field-error";
import { useFieldContext } from "@/components/form/form-context";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function SelectField({
  label,
  options,
  placeholder,
  className,
}: {
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  const field = useFieldContext<string>();
  const id = useId();
  const errors =
    field.state.meta.isTouched || field.form.state.submissionAttempts > 0
      ? field.state.meta.errors
      : [];
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={field.state.value}
        onValueChange={(v) => field.handleChange(v)}
      >
        <SelectTrigger
          id={id}
          className="h-11 w-full rounded-xl"
          aria-invalid={errors.length > 0}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={`${id}-error`} errors={errors} />
    </div>
  );
}
