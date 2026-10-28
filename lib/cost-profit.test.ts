import { describe, expect, it } from "vitest";
import { entryProfit, marginPercent, suggestPrice } from "./cost-profit";

describe("cost & profit math", () => {
  it("computes a platform entry", () => {
    expect(
      entryProfit({
        quantity: 10,
        unitCost: "25.00",
        unitPrice: "60.00",
        platformFeeRate: "30",
      }),
    ).toEqual({
      revenue: "600.00",
      fee: "180.00",
      cost: "250.00",
      netProfit: "170.00",
      marginPercent: "28.33",
    });
  });

  it("handles zero revenue", () => {
    expect(
      entryProfit({
        quantity: 1,
        unitCost: "5",
        unitPrice: "0",
        platformFeeRate: "0",
      }).marginPercent,
    ).toBe("0.00");
    expect(marginPercent("0", "10")).toBe("0.00");
  });

  it("suggests a price that keeps the target margin after fees", () => {
    // 30 / (1 − 0.30 − 0.20) = 60
    expect(
      suggestPrice({ cost: "30", feePercent: "30", targetMarginPercent: "20" }),
    ).toEqual({
      price: "60.00",
      fee: "18.00",
      profitPerUnit: "12.00",
      marginPercent: "20.00",
    });
    expect(
      suggestPrice({ cost: "30", feePercent: "0", targetMarginPercent: "40" })
        ?.price,
    ).toBe("50.00");
  });

  it("returns null when fee + margin leaves nothing", () => {
    expect(
      suggestPrice({ cost: "30", feePercent: "60", targetMarginPercent: "40" }),
    ).toBeNull();
  });
});
