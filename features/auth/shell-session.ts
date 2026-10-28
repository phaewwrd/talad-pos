import "server-only";
import type { ShellSession } from "@/components/shell/shell-types";

// TODO(milestone-3): replace with the real Better Auth session + active org.
export async function getShellSession(): Promise<ShellSession> {
  return {
    user: { id: "demo", name: "Demo Owner", image: null },
    role: "owner",
    isPlatformAdmin: false,
    activeShop: { id: "demo", name: "ร้านตัวอย่าง", logoUrl: null },
    shops: [{ id: "demo", name: "ร้านตัวอย่าง" }],
    isPinSession: false,
  };
}
