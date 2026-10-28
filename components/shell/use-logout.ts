"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async () => {
    await authClient.signOut();
    queryClient.clear();
    router.replace("/login");
    router.refresh();
  };
}
