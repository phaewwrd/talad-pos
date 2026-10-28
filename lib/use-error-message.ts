"use client";

import { useTranslations } from "next-intl";
import { ERROR_CODES, type ErrorCode } from "@/lib/errors";

const DEFAULT_ARGS = {
  max: "",
  product: "",
  available: "",
  feature: "",
  error: "",
};

/** Translate a server error code (+ details) into the current locale. */
export function useErrorMessage() {
  const t = useTranslations("errors");
  return (
    code: string | undefined | null,
    details?: Record<string, string | number>,
  ) => {
    const known = (ERROR_CODES as readonly string[]).includes(code ?? "");
    return t((known ? code : "UNKNOWN") as ErrorCode, {
      ...DEFAULT_ARGS,
      ...details,
    });
  };
}
