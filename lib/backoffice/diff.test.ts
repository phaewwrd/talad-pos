import { describe, expect, it } from "vitest";
import { diffJson } from "./diff";

describe("diffJson", () => {
  it("flattens nested objects and marks changes", () => {
    const rows = diffJson(
      { limits: { maxShops: 1, maxProducts: 100 }, status: "active" },
      { limits: { maxShops: 1, maxProducts: null }, status: "suspended" },
    );
    expect(rows).toEqual([
      { path: "limits.maxProducts", before: 100, after: null, changed: true },
      { path: "limits.maxShops", before: 1, after: 1, changed: false },
      { path: "status", before: "active", after: "suspended", changed: true },
    ]);
  });

  it("handles one side missing", () => {
    expect(diffJson(null, { a: 1 })).toEqual([
      { path: "a", before: undefined, after: 1, changed: true },
    ]);
  });
});
