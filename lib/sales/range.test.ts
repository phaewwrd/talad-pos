import { describe, expect, it } from "vitest";
import {
  bucketKey,
  bucketsFor,
  daysBetween,
  previousRange,
  resolveRange,
} from "./range";

const now = new Date("2026-10-28T05:00:00Z"); // Wed 28 Oct 2026, Bangkok

describe("sales ranges", () => {
  it("resolves presets in Bangkok time", () => {
    expect(resolveRange("today", now)).toEqual({
      from: "2026-10-28",
      to: "2026-10-28",
    });
    expect(resolveRange("7d", now)).toEqual({
      from: "2026-10-22",
      to: "2026-10-28",
    });
    expect(resolveRange("month", now)).toEqual({
      from: "2026-10-01",
      to: "2026-10-28",
    });
    expect(
      resolveRange("custom", now, { from: "2026-10-10", to: "2026-10-05" }),
    ).toEqual({
      from: "2026-10-05",
      to: "2026-10-10",
    });
  });

  it("previous period has the same length, right before", () => {
    const r = { from: "2026-10-22", to: "2026-10-28" };
    expect(previousRange(r)).toEqual({ from: "2026-10-15", to: "2026-10-21" });
    expect(daysBetween(previousRange(r))).toBe(7);
  });

  it("buckets weeks from Monday and months from the 1st", () => {
    expect(bucketKey("2026-10-28", "week")).toBe("2026-10-26");
    expect(bucketKey("2026-10-26", "week")).toBe("2026-10-26");
    expect(bucketKey("2026-10-28", "month")).toBe("2026-10-01");
    expect(
      bucketsFor({ from: "2026-10-24", to: "2026-10-28" }, "week"),
    ).toEqual(["2026-10-19", "2026-10-26"]);
    expect(
      bucketsFor({ from: "2026-10-01", to: "2026-10-03" }, "day"),
    ).toHaveLength(3);
  });
});
