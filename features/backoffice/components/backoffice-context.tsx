"use client";

import { createContext, use } from "react";
import { type Capability, can } from "@/lib/backoffice/permissions";
import type { BackofficeRole } from "@/lib/backoffice/roles";

export type BackofficeViewer = {
  user: { id: string; name: string; email: string };
  role: BackofficeRole;
};

const BackofficeContext = createContext<BackofficeViewer | null>(null);

export function BackofficeProvider({
  viewer,
  children,
}: {
  viewer: BackofficeViewer;
  children: React.ReactNode;
}) {
  return <BackofficeContext value={viewer}>{children}</BackofficeContext>;
}

export function useBackofficeViewer() {
  const viewer = use(BackofficeContext);
  if (!viewer)
    throw new Error("useBackofficeViewer outside BackofficeProvider");
  return viewer;
}

/** UI-side check only; the server enforces the same matrix. */
export function useCan() {
  const { role } = useBackofficeViewer();
  return (capability: Capability) => can(role, capability);
}
