import { describe, expect, it, vi } from "vitest";
import { platformAuditLogs } from "@/db/schema";
import { writeAudit } from "./audit";

function fakeTx() {
  const values = vi.fn(() => ({
    returning: vi.fn(async () => [{ id: "audit-1" }]),
  }));
  const insert = vi.fn(() => ({ values }));
  return { tx: { insert } as never, insert, values };
}

describe("writeAudit", () => {
  it("inserts exactly one row into platform_audit_logs", async () => {
    const { tx, insert, values } = fakeTx();
    const row = await writeAudit(tx, {
      actor: { id: "u1", label: "dev@talad.app" },
      action: "shop.suspend",
      targetType: "shop",
      targetId: "org-1",
      reason: "  unpaid  ",
      before: { status: "active" },
      after: { status: "suspended" },
      ip: "1.2.3.4",
      userAgent: "UA",
    });
    expect(row).toEqual({ id: "audit-1" });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(platformAuditLogs);
    expect(values).toHaveBeenCalledWith({
      actorId: "u1",
      actorLabel: "dev@talad.app",
      action: "shop.suspend",
      targetType: "shop",
      targetId: "org-1",
      reason: "unpaid",
      before: { status: "active" },
      after: { status: "suspended" },
      ip: "1.2.3.4",
      userAgent: "UA",
    });
  });

  it("records scripts with a null actor id and normalizes empty fields", async () => {
    const { tx, values } = fakeTx();
    await writeAudit(tx, {
      actor: { id: null, label: "system:script" },
      action: "backoffice_user.create",
      targetType: "backoffice_user",
      targetId: "u2",
      reason: "   ",
    });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        actorLabel: "system:script",
        reason: null,
        before: null,
        after: null,
        ip: null,
        userAgent: null,
      }),
    );
  });
});
