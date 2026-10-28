import type { ErrorCode } from "@/lib/errors";

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, string | number>,
  ) {
    super(code);
  }
}

/** GET a JSON route handler; throws ApiError with the server's error code. */
export async function getJson<T>(
  url: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  }
  const qs = search.toString();
  const res = await fetch(qs ? `${url}?${qs}` : url, { cache: "no-store" });
  const body = await res.json().catch(() => ({ code: "UNKNOWN" }));
  if (!res.ok) throw new ApiError(body.code ?? "UNKNOWN", body.details);
  return body as T;
}

/** Unwrap a Server Action result for TanStack Query mutations. */
export function unwrap<T>(
  result:
    | { ok: true; data: T }
    | { ok: false; code: ErrorCode; details?: Record<string, string | number> },
): T {
  if (!result.ok) throw new ApiError(result.code, result.details);
  return result.data;
}
