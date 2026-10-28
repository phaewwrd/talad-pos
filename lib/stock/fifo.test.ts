import { describe, expect, it } from "vitest";
import {
  allocateFifo,
  costOfGoodsSold,
  type FifoLot,
  InsufficientStockError,
  mergeAllocations,
  releaseAllocations,
} from "./fifo";

const lots: FifoLot[] = [
  {
    id: "L3",
    stockInDate: "2026-10-20",
    createdAt: new Date("2026-10-20T03:00:00Z"),
    remainingQuantity: 10,
  },
  {
    id: "L1",
    stockInDate: "2026-10-01",
    createdAt: new Date("2026-10-01T03:00:00Z"),
    remainingQuantity: 3,
  },
  {
    id: "L2b",
    stockInDate: "2026-10-10",
    createdAt: new Date("2026-10-10T05:00:00Z"),
    remainingQuantity: 4,
  },
  {
    id: "L2a",
    stockInDate: "2026-10-10",
    createdAt: new Date("2026-10-10T01:00:00Z"),
    remainingQuantity: 2,
  },
  {
    id: "L0",
    stockInDate: "2026-09-01",
    createdAt: new Date("2026-09-01T03:00:00Z"),
    remainingQuantity: 0,
  },
];

describe("allocateFifo", () => {
  it("takes from the oldest lot first (date, then created_at)", () => {
    expect(allocateFifo("p", lots, 7)).toEqual([
      { lotId: "L1", quantity: 3 },
      { lotId: "L2a", quantity: 2 },
      { lotId: "L2b", quantity: 2 },
    ]);
  });

  it("fits within a single lot", () => {
    expect(allocateFifo("p", lots, 2)).toEqual([{ lotId: "L1", quantity: 2 }]);
  });

  it("can use all stock", () => {
    const all = allocateFifo("p", lots, 19);
    expect(all.reduce((n, a) => n + a.quantity, 0)).toBe(19);
    expect(all.at(-1)).toEqual({ lotId: "L3", quantity: 10 });
  });

  it("rejects insufficient stock without partial allocation", () => {
    expect(() => allocateFifo("p", lots, 20)).toThrow(InsufficientStockError);
    try {
      allocateFifo("p", lots, 20);
    } catch (e) {
      expect(e).toMatchObject({
        code: "INSUFFICIENT_STOCK",
        requested: 20,
        available: 19,
      });
    }
  });

  it("rejects non-positive quantities", () => {
    expect(() => allocateFifo("p", lots, 0)).toThrow(RangeError);
  });
});

describe("releaseAllocations", () => {
  const allocations = [
    { lotId: "L1", quantity: 3 },
    { lotId: "L2a", quantity: 2 },
    { lotId: "L2b", quantity: 2 },
  ];

  it("returns units to the same lots, newest allocation first", () => {
    expect(releaseAllocations(allocations, 3)).toEqual({
      released: [
        { lotId: "L2b", quantity: 2 },
        { lotId: "L2a", quantity: 1 },
      ],
      kept: [
        { lotId: "L1", quantity: 3 },
        { lotId: "L2a", quantity: 1 },
      ],
    });
  });

  it("full release (cancel / delete) restores exactly what was taken", () => {
    const { released, kept } = releaseAllocations(allocations, 7);
    expect(kept).toEqual([]);
    expect(
      mergeAllocations(released).sort((a, b) => a.lotId.localeCompare(b.lotId)),
    ).toEqual([...allocations].sort((a, b) => a.lotId.localeCompare(b.lotId)));
  });

  it("rejects releasing more than allocated", () => {
    expect(() => releaseAllocations(allocations, 8)).toThrow(RangeError);
  });
});

describe("costOfGoodsSold", () => {
  it("sums allocation quantity × lot cost with decimals", () => {
    expect(
      costOfGoodsSold([
        { quantity: 3, lotCost: "12.10" },
        { quantity: 2, lotCost: "12.35" },
      ]),
    ).toBe("61.00");
  });
});
