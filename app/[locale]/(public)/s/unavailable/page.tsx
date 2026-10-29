import { notFound } from "next/navigation";

// proxy.ts rewrites dead supplier links here. Calling notFound() during
// prerender keeps this page static and answers with a real 404 status
// (the [token] page streams, so its own notFound() would still send 200).
export default function SupplierLinkUnavailablePage() {
  notFound();
}
