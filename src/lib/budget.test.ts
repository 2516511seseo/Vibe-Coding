import { describe, expect, it } from "vitest";
import { allocateAmount, daysInclusive, summarizePlan, swapPriority, validateForm } from "./budget";
import type { SavedPlan } from "./types";

describe("생활비 계산", () => {
  it("배분 합계가 입력 금액과 일치한다", () => {
    const split = allocateAmount(100_001, { food: 1, transport: 2, leisure: 3 });
    expect(split).toEqual({ food: 50_000, transport: 30_000, leisure: 20_001 });
    expect(Object.values(split).reduce((a, b) => a + b, 0)).toBe(100_001);
  });

  it("윤년 날짜를 양끝 포함으로 계산한다", () => {
    expect(daysInclusive("2028-02-28", "2028-03-01")).toBe(3);
  });

  it("예상 등교일수를 주간 평균으로 반올림한다", () => {
    const plan: SavedPlan = {
      id: "sample", createdAt: "2026-11-19T00:00:00.000Z", startDate: "2026-11-19",
      input: { amount: 300_000, endDate: "2026-11-30", schoolDaysPerWeek: 5, priorities: { food: 1, transport: 2, leisure: 3 } }, expenses: [],
    };
    expect(summarizePlan(plan, "2026-11-19").expectedSchoolDays).toBe(9);
    expect(summarizePlan(plan, "2026-11-19").commuteDaily).toBe(10_000);
  });

  it("순위를 바꾸면 같은 순위끼리 맞교환한다", () => {
    expect(swapPriority({ food: 1, transport: 2, leisure: 3 }, "transport", 1))
      .toEqual({ food: 2, transport: 1, leisure: 3 });
  });

  it("초과 지출 후 낮은 우선순위 항목부터 하루 한도를 줄인다", () => {
    const plan: SavedPlan = {
      id: "sample", createdAt: "2026-11-19T00:00:00.000Z", startDate: "2026-11-19",
      input: { amount: 300_000, endDate: "2026-11-30", schoolDaysPerWeek: 5, priorities: { food: 1, transport: 2, leisure: 3 } },
      expenses: [{ id: "expense", date: "2026-11-20", category: "food", amount: 100_000 }],
    };
    const result = summarizePlan(plan, "2026-11-21");
    expect(result.remainingDays).toBe(10);
    expect(result.remainingAmount).toBe(200_000);
    expect(result.remainingDaily).toBe(20_000);
    expect(result.extraDailySavings).toBe(5_000);
    expect(result.categoryDaily).toEqual({ food: 12_500, transport: 7_500, leisure: 0 });
  });

  it("빈 값과 잘못된 등교일수를 알려준다", () => {
    expect(validateForm({ amount: "", endDate: "", schoolDaysPerWeek: "8" }, { food: 1, transport: 2, leisure: 3 }, "2026-11-19"))
      .toMatchObject({ amount: expect.any(String), endDate: expect.any(String), schoolDaysPerWeek: expect.any(String) });
  });
});
