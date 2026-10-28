import { describe, expect, it } from "vitest";
import { formatOrderNumber, orderDateKey, parseOrderSeq } from "./order-number";

describe("order numbers", () => {
  it("uses the Bangkok calendar day", () => {
    // 2026-10-28 18:30 UTC is already 29 Oct in Bangkok (UTC+7)
    expect(orderDateKey(new Date("2026-10-28T18:30:00Z"))).toBe("261029");
    expect(orderDateKey(new Date("2026-10-28T16:59:59Z"))).toBe("261028");
  });

  it("formats {prefix}-{YYMMDD}-{seq}", () => {
    expect(formatOrderNumber("TL", new Date("2026-10-28T05:00:00Z"), 7)).toBe(
      "TL-261028-0007",
    );
  });

  it("parses the sequence back", () => {
    expect(parseOrderSeq("TL-261028-0042")).toBe(42);
    expect(parseOrderSeq("garbage")).toBe(0);
  });
});
