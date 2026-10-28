import { describe, expect, it } from "vitest";
import { classifyTransition, nextStatus } from "./status";

describe("order status transitions", () => {
  it("classifies moves", () => {
    expect(classifyTransition("Pending", "In Progress")).toBe("forward");
    expect(classifyTransition("Pending", "Completed")).toBe("forward");
    expect(classifyTransition("Ready", "Pending")).toBe("backward");
    expect(classifyTransition("Completed", "Cancelled")).toBe("cancel");
    expect(classifyTransition("Cancelled", "Pending")).toBe("invalid");
    expect(classifyTransition("Ready", "Ready")).toBe("none");
  });

  it("next status follows the flow", () => {
    expect(nextStatus("Pending")).toBe("In Progress");
    expect(nextStatus("Ready")).toBe("Completed");
    expect(nextStatus("Completed")).toBeNull();
    expect(nextStatus("Cancelled")).toBeNull();
  });
});
