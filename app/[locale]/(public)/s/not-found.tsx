import type { Metadata } from "next";
import { LinkUnavailable } from "@/features/suppliers/components/link-unavailable";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** The same generic message for unknown, disabled and regenerated links. */
export default function SupplierLinkNotFound() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-4 py-6">
      <LinkUnavailable />
    </main>
  );
}
