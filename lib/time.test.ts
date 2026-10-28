import { describe, expect, it } from "vitest";
import { bangkokDateString, fromBangkokLocal, startOfBangkokDay, toBangkokLocal } from "./time";

describe("Asia/Bangkok time helpers", () => {
  it("round-trips datetime-local values", () => {
    const d = fromBangkokLocal("2026-10-28T09:30");
    expect(d.toISOString()).toBe("2026-10-28T02:30:00.000Z");
    expect(toBangkokLocal(d)).toBe("2026-10-28T09:30");
  });

  it("uses Bangkok day boundaries", () => {
    const lateUtc = new Date("2026-10-28T20:00:00Z"); // 03:00 on the 29th in Bangkok
    expect(bangkokDateString(lateUtc)).toBe("2026-10-29");
    expect(startOfBangkokDay(lateUtc).toISOString()).toBe("2026-10-28T17:00:00.000Z");
  });
});
