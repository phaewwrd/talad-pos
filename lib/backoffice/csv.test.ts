import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("starts with a BOM and quotes special characters", () => {
    const csv = toCsv(["a", "b"], [["ร้าน, ป้าแดง", 'say "hi"']]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"ร้าน, ป้าแดง","say ""hi"""');
  });

  it("neutralizes formula injection", () => {
    expect(toCsv(["x"], [["=1+1"]])).toContain("'=1+1");
  });

  it("renders null as empty and objects as JSON", () => {
    expect(toCsv(["a", "b"], [[null, { k: 1 }]])).toContain(',"{""k"":1}"');
  });
});
