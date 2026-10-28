"use client";

import { useTranslations } from "next-intl";

/** Zod issue messages are translation keys under `validation.*`. */
export function useErrorText() {
  const t = useTranslations("validation");
  return (error: unknown) => {
    const key =
      typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "invalid";
    return t.has(key as never) ? t(key as never) : t("invalid");
  };
}

export function FieldError({ id, errors }: { id: string; errors: unknown[] }) {
  const text = useErrorText();
  if (errors.length === 0) return null;
  return (
    <p id={id} role="alert" className="text-destructive text-sm">
      {text(errors[0])}
    </p>
  );
}
