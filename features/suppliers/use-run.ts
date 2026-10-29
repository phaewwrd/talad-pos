"use client";

import { toast } from "sonner";
import { useErrorMessage } from "@/lib/use-error-message";
import { useInvalidateSuppliers } from "./hooks";

type Result =
  | { ok: true }
  | { ok: false; code: string; details?: Record<string, string | number> };

/** Await a supplier action, toast the outcome and refetch on success. */
export function useRun(orgId: string) {
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidateSuppliers(orgId);
  return async (p: Promise<Result>, success: string) => {
    const r = await p;
    if (!r.ok) {
      toast.error(errorMessage(r.code, r.details));
      return false;
    }
    toast.success(success);
    invalidate();
    return true;
  };
}
