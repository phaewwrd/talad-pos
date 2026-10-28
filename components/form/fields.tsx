"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FieldError } from "./field-error";
import { useFieldContext } from "./form-context";

type BaseProps = {
  label: string;
  hint?: string;
  className?: string;
};

function useFieldIds() {
  const id = useId();
  return {
    inputId: `${id}-input`,
    errorId: `${id}-error`,
    hintId: `${id}-hint`,
  };
}

export function TextField({
  label,
  hint,
  className,
  ...input
}: BaseProps &
  Omit<
    React.ComponentProps<typeof Input>,
    "value" | "onChange" | "onBlur" | "name"
  >) {
  const field = useFieldContext<string>();
  const { inputId, errorId, hintId } = useFieldIds();
  const errors =
    field.state.meta.isTouched || field.form.state.submissionAttempts > 0
      ? field.state.meta.errors
      : [];
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={field.name}
        value={field.state.value ?? ""}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        aria-invalid={errors.length > 0}
        aria-describedby={
          cn(errors.length > 0 && errorId, hint && hintId) || undefined
        }
        className="h-11 rounded-xl"
        {...input}
      />
      {hint && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      <FieldError id={errorId} errors={errors} />
    </div>
  );
}

export function TextareaField({
  label,
  hint,
  className,
  ...input
}: BaseProps &
  Omit<
    React.ComponentProps<typeof Textarea>,
    "value" | "onChange" | "onBlur" | "name"
  >) {
  const field = useFieldContext<string>();
  const { inputId, errorId } = useFieldIds();
  const errors =
    field.state.meta.isTouched || field.form.state.submissionAttempts > 0
      ? field.state.meta.errors
      : [];
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <Textarea
        id={inputId}
        name={field.name}
        value={field.state.value ?? ""}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        aria-invalid={errors.length > 0}
        className="rounded-xl"
        {...input}
      />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      <FieldError id={errorId} errors={errors} />
    </div>
  );
}

export function SwitchField({ label, hint, className }: BaseProps) {
  const field = useFieldContext<boolean>();
  const { inputId } = useFieldIds();
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border bg-card p-3",
        className,
      )}
    >
      <div className="grid gap-0.5">
        <Label htmlFor={inputId}>{label}</Label>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      <Switch
        id={inputId}
        checked={field.state.value}
        onCheckedChange={(v) => field.handleChange(v)}
      />
    </div>
  );
}
