import { describe, expect, it } from "vitest";
import type { PromotionRule } from "@/lib/promotions/apply";
import { type CalculateOrderInput, calculateOrder } from "./calculate-order";

const now = new Date("2026-10-28T05:00:00Z");

const noTax = {
  serviceCharge: { enabled: false, rate: "10.00" },
  vat: { mode: "none" as const, rate: "7.00" },
};

const baseLines: CalculateOrderInput["lines"] = [
  {
    productId: "p-rice",
    categoryId: "c-food",
    productName: "ข้าวกะเพรา",
    unitPrice: "50.00",
    quantity: 2,
  },
  {
    productId: "p-tea",
    categoryId: "c-drink",
    productName: "ชาไทย",
    unitPrice: "35.50",
    quantity: 1,
  },
];

function promo(overrides: Partial<PromotionRule>): PromotionRule {
  return {
    id: "promo",
    name: "Promo",
    discountType: "percentage",
    discountValue: "10",
    minimumType: "quantity",
    minimumQuantity: 1,
    minimumAmount: null,
    startAt: new Date("2026-10-01T00:00:00+07:00"),
    endAt: new Date("2026-10-31T23:59:59+07:00"),
    isActive: true,
    productIds: [],
    categoryIds: [],
    ...overrides,
  };
}

function calc(overrides: Partial<CalculateOrderInput>) {
  return calculateOrder({
    lines: baseLines,
    promotions: [],
    now,
    ...noTax,
    ...overrides,
  });
}

describe("calculateOrder — VAT and service charge", () => {
  it("no VAT, no service charge", () => {
    const r = calc({});
    expect(r.lines.map((l) => l.lineSubtotal)).toEqual(["100.00", "35.50"]);
    expect(r).toMatchObject({
      subtotal: "135.50",
      discountTotal: "0.00",
      serviceChargeAmount: "0.00",
      vatMode: "none",
      vatRate: "0.00",
      vatAmount: "0.00",
      total: "135.50",
    });
  });

  it("service charge only", () => {
    const r = calc({ serviceCharge: { enabled: true, rate: "10.00" } });
    expect(r.serviceChargeRate).toBe("10.00");
    expect(r.serviceChargeAmount).toBe("13.55");
    expect(r.total).toBe("149.05");
  });

  it("VAT inclusive — total unchanged, VAT extracted", () => {
    const r = calc({ vat: { mode: "inclusive", rate: "7.00" } });
    // 135.50 × 7 / 107 = 8.8644…
    expect(r.vatAmount).toBe("8.86");
    expect(r.total).toBe("135.50");
  });

  it("VAT exclusive — added to total, rounds half-up", () => {
    const r = calc({ vat: { mode: "exclusive", rate: "7.00" } });
    // 135.50 × 0.07 = 9.485 exactly → 9.49
    expect(r.vatAmount).toBe("9.49");
    expect(r.total).toBe("144.99");
  });

  it("service charge + VAT inclusive", () => {
    const r = calc({
      serviceCharge: { enabled: true, rate: "10.00" },
      vat: { mode: "inclusive", rate: "7.00" },
    });
    // (135.50 + 13.55) × 7 / 107 = 9.7509…
    expect(r.vatAmount).toBe("9.75");
    expect(r.total).toBe("149.05");
  });

  it("service charge + VAT exclusive", () => {
    const r = calc({
      serviceCharge: { enabled: true, rate: "10.00" },
      vat: { mode: "exclusive", rate: "7.00" },
    });
    // 149.05 × 0.07 = 10.4335 → 10.43
    expect(r.vatAmount).toBe("10.43");
    expect(r.total).toBe("159.48");
  });

  it("disabled service charge ignores its rate", () => {
    const r = calc({ serviceCharge: { enabled: false, rate: "15.00" } });
    expect(r.serviceChargeRate).toBe("0.00");
    expect(r.total).toBe("135.50");
  });

  it("avoids float drift (0.1 + 0.2 style prices)", () => {
    const r = calc({
      lines: [
        {
          productId: "a",
          categoryId: "c",
          productName: "A",
          unitPrice: "0.10",
          quantity: 1,
        },
        {
          productId: "b",
          categoryId: "c",
          productName: "B",
          unitPrice: "0.20",
          quantity: 1,
        },
      ],
    });
    expect(r.total).toBe("0.30");
  });

  it("rejects invalid quantities", () => {
    expect(() => calc({ lines: [{ ...baseLines[0], quantity: 0 }] })).toThrow(
      RangeError,
    );
    expect(() => calc({ lines: [{ ...baseLines[0], quantity: 1.5 }] })).toThrow(
      RangeError,
    );
  });
});

describe("calculateOrder — promotions", () => {
  const drinks10 = promo({
    id: "drinks10",
    name: "เครื่องดื่มลด 10%",
    categoryIds: ["c-drink"],
    minimumQuantity: 2,
  });

  const lines: CalculateOrderInput["lines"] = [
    {
      productId: "p-tea",
      categoryId: "c-drink",
      productName: "ชาไทย",
      unitPrice: "25.00",
      quantity: 2,
    },
    {
      productId: "p-rice",
      categoryId: "c-food",
      productName: "ข้าว",
      unitPrice: "100.00",
      quantity: 1,
    },
  ];

  it("percentage promo with VAT exclusive and service charge", () => {
    const r = calc({
      lines,
      promotions: [drinks10],
      serviceCharge: { enabled: true, rate: "10.00" },
      vat: { mode: "exclusive", rate: "7.00" },
    });
    expect(r.subtotal).toBe("150.00");
    expect(r.discountTotal).toBe("5.00");
    expect(r.afterDiscount).toBe("145.00");
    expect(r.serviceChargeAmount).toBe("14.50");
    // 159.50 × 0.07 = 11.165 → 11.17
    expect(r.vatAmount).toBe("11.17");
    expect(r.total).toBe("170.67");
    expect(r.lines[0]).toMatchObject({
      discountAmount: "5.00",
      lineTotal: "45.00",
      promotionId: "drinks10",
    });
    expect(r.lines[1]).toMatchObject({
      discountAmount: "0.00",
      promotionId: null,
    });
    expect(r.promotions).toEqual([
      expect.objectContaining({
        promotionId: "drinks10",
        matchedQuantity: 2,
        discountAmount: "5.00",
        lineIndexes: [0],
      }),
    ]);
  });

  it("percentage promo with VAT inclusive", () => {
    const r = calc({
      lines,
      promotions: [drinks10],
      vat: { mode: "inclusive", rate: "7.00" },
    });
    // 145 × 7 / 107 = 9.4859… → 9.49
    expect(r.vatAmount).toBe("9.49");
    expect(r.total).toBe("145.00");
  });

  it("quantity minimum not met → no discount", () => {
    const r = calc({
      lines: [{ ...lines[0], quantity: 1 }],
      promotions: [drinks10],
    });
    expect(r.discountTotal).toBe("0.00");
    expect(r.promotions).toEqual([]);
  });

  it("amount minimum", () => {
    const p = promo({
      id: "amt",
      discountType: "fixed",
      discountValue: "20",
      minimumType: "amount",
      minimumAmount: "100.00",
      categoryIds: ["c-food"],
    });
    expect(calc({ lines, promotions: [p] }).discountTotal).toBe("20.00");
    expect(
      calc({
        lines: [{ ...lines[1], unitPrice: "99.99" }],
        promotions: [p],
      }).discountTotal,
    ).toBe("0.00");
  });

  it("fixed discount never exceeds the matched subtotal", () => {
    const p = promo({
      id: "big",
      discountType: "fixed",
      discountValue: "500",
      productIds: ["p-tea"],
    });
    const r = calc({ lines, promotions: [p] });
    expect(r.discountTotal).toBe("50.00");
    expect(r.lines[0].lineTotal).toBe("0.00");
  });

  it("ignores inactive or out-of-window promotions", () => {
    const expired = promo({
      id: "old",
      categoryIds: ["c-drink"],
      endAt: new Date("2026-10-27T23:59:59+07:00"),
    });
    const off = promo({ id: "off", categoryIds: ["c-drink"], isActive: false });
    const future = promo({
      id: "future",
      categoryIds: ["c-drink"],
      startAt: new Date("2026-10-29T00:00:00+07:00"),
    });
    const r = calc({ lines, promotions: [expired, off, future] });
    expect(r.discountTotal).toBe("0.00");
  });

  it("cashier can remove an applied promotion", () => {
    const r = calc({
      lines,
      promotions: [drinks10],
      excludedPromotionIds: ["drinks10"],
    });
    expect(r.discountTotal).toBe("0.00");
  });

  it("no stacking: picks the assignment with the largest discount", () => {
    // X matches both A (10% on product) and B (฿20 on category, min ฿50).
    // Y matches only B. Best: X→A (10) + Y→B (20) = 30, not both→B (20).
    const A = promo({ id: "A", productIds: ["x"] });
    const B = promo({
      id: "B",
      discountType: "fixed",
      discountValue: "20",
      minimumType: "amount",
      minimumAmount: "50.00",
      categoryIds: ["cat"],
    });
    const r = calc({
      lines: [
        {
          productId: "x",
          categoryId: "cat",
          productName: "X",
          unitPrice: "100.00",
          quantity: 1,
        },
        {
          productId: "y",
          categoryId: "cat",
          productName: "Y",
          unitPrice: "100.00",
          quantity: 1,
        },
      ],
      promotions: [B, A],
    });
    expect(r.discountTotal).toBe("30.00");
    expect(r.lines.map((l) => l.promotionId)).toEqual(["A", "B"]);
    expect(r.lines.map((l) => l.discountAmount)).toEqual(["10.00", "20.00"]);
  });

  it("each line gets at most one promotion", () => {
    const A = promo({ id: "A", discountValue: "10", categoryIds: ["c-drink"] });
    const B = promo({ id: "B", discountValue: "20", productIds: ["p-tea"] });
    const r = calc({ lines, promotions: [A, B] });
    expect(r.discountTotal).toBe("10.00"); // 20% of 50, not 10% + 20%
    expect(r.promotions.map((p) => p.promotionId)).toEqual(["B"]);
  });

  it("distributes a group discount proportionally and exactly", () => {
    const p = promo({
      id: "fixed10",
      discountType: "fixed",
      discountValue: "10",
      categoryIds: ["c"],
    });
    const r = calc({
      lines: ["a", "b", "c"].map((id) => ({
        productId: id,
        categoryId: "c",
        productName: id,
        unitPrice: "30.00",
        quantity: 1,
      })),
      promotions: [p],
    });
    const shares = r.lines.map((l) => l.discountAmount);
    expect(shares.sort()).toEqual(["3.33", "3.33", "3.34"]);
    expect(r.discountTotal).toBe("10.00");
    expect(r.total).toBe("80.00");
  });
});
