"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import type { BackofficeNextStep } from "../schemas";

const PATHS: Record<BackofficeNextStep, string> = {
  console: "/backoffice",
  "change-password": "/backoffice/change-password",
  "setup-2fa": "/backoffice/setup-2fa",
  "verify-2fa": "/backoffice/verify-2fa",
};

/** Navigate to the next forced step (or the console) after an auth action. */
export function useBackofficeNext() {
  const router = useRouter();
  return (next: BackofficeNextStep) => {
    router.replace(PATHS[next]);
    router.refresh();
  };
}

export function useBackofficeLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return async () => {
    await authClient.signOut();
    queryClient.clear();
    router.replace("/backoffice/login");
    router.refresh();
  };
}
