import { describe, expect, it } from "vitest";
import { pgTimestampToIso } from "./pg-time";

describe("pgTimestampToIso", () => {
  it.each([
    ["2026-10-28 05:00:00.123+00", "2026-10-28T05:00:00.123Z"],
    ["2026-10-28 12:00:00+07", "2026-10-28T05:00:00.000Z"],
    ["2026-10-28 10:30:00+05:30", "2026-10-28T05:00:00.000Z"],
    ["2026-10-28 05:00:00", "2026-10-28T05:00:00.000Z"],
    ["2026-10-28T05:00:00Z", "2026-10-28T05:00:00.000Z"],
  ])("%s → %s", (input, out) => {
    expect(pgTimestampToIso(input)).toBe(out);
  });

  it("passes Dates and nulls through", () => {
    expect(pgTimestampToIso(new Date("2026-01-01T00:00:00Z"))).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(pgTimestampToIso(null)).toBeNull();
  });
});
