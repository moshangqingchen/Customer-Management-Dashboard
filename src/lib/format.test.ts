import { describe, expect, it } from "vitest";

import { formatCents, getStatusTone, paymentProgress } from "./format";

describe("format helpers", () => {
  it("formats integer cents as CNY without floating point artifacts", () => {
    expect(formatCents(5597)).toBe("¥55.97");
    expect(formatCents(0)).toBe("¥0.00");
  });

  it("maps workflow states to stable visual tones", () => {
    expect(getStatusTone("待设计")).toBe("orange");
    expect(getStatusTone("设计完成")).toBe("green");
    expect(getStatusTone("已发货")).toBe("blue");
    expect(getStatusTone("已取消")).toBe("gray");
  });

  it("caps payment progress at one hundred percent", () => {
    expect(paymentProgress(10_000, 4_000)).toBe(40);
    expect(paymentProgress(10_000, 11_000)).toBe(100);
    expect(paymentProgress(0, 0)).toBe(100);
  });
});

