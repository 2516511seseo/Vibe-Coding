import { describe, expect, it } from "vitest";
import { allocateAmount, buildDailyPlanCards, dailyMealBudgetForCard, daysInclusive, normalizeForm, summarizePlan, validateForm } from "./budget";
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

  it("예상 외출일수를 주간 평균으로 반올림한다", () => {
    const plan: SavedPlan = {
      id: "sample", createdAt: "2026-11-19T00:00:00.000Z", startDate: "2026-11-19",
      input: { amount: 300_000, endDate: "2026-11-30", outingDaysPerWeek: 5, priorities: { food: 1, transport: 2, leisure: 3 }, fixedExpenses: [] }, expenses: [],
    };
    expect(summarizePlan(plan, "2026-11-19").expectedOutingDays).toBe(9);
    expect(summarizePlan(plan, "2026-11-19").transportPerOutingDay).toBe(10_000);
  });

  it("초과 지출 후 낮은 우선순위 항목부터 하루 한도를 줄인다", () => {
    const plan: SavedPlan = {
      id: "sample", createdAt: "2026-11-19T00:00:00.000Z", startDate: "2026-11-19",
      input: { amount: 300_000, endDate: "2026-11-30", outingDaysPerWeek: 5, priorities: { food: 1, transport: 2, leisure: 3 }, fixedExpenses: [] },
      expenses: [{ id: "expense", date: "2026-11-20", category: "food", amount: 100_000 }],
    };
    const result = summarizePlan(plan, "2026-11-21");
    expect(result.remainingDays).toBe(10);
    expect(result.remainingAmount).toBe(200_000);
    expect(result.remainingDaily).toBe(20_000);
    expect(result.extraDailySavings).toBe(5_000);
    expect(result.categoryDaily).toEqual({ food: 12_500, transport: 7_500, leisure: 0 });
  });

  it("빈 값과 잘못된 외출일수를 알려준다", () => {
    expect(validateForm({ amount: "", endDate: "", outingDaysPerWeek: "8" }, { food: 1, transport: 2, leisure: 3 }, "2026-11-19"))
      .toMatchObject({ amount: expect.any(String), endDate: expect.any(String), outingDaysPerWeek: expect.any(String) });
  });

  it("고정지출을 제외한 금액에 50/30/20 비율을 적용한다", () => {
    const input = normalizeForm(
      { amount: "300000", endDate: "2026-11-21", outingDaysPerWeek: "5" },
      { food: 1, transport: 2, leisure: 3 },
      [{ id: "rent", amount: "30000", transferDate: "2026-11-20" }],
    );
    const plan: SavedPlan = { id: "fixed", createdAt: "", startDate: "2026-11-19", input, expenses: [] };
    expect(summarizePlan(plan, "2026-11-19").categoryAmounts).toEqual({ food: 135_000, transport: 81_000, leisure: 54_000 });
    expect(validateForm(
      { amount: "20000", endDate: "2026-11-21", outingDaysPerWeek: "5" },
      { food: 1, transport: 2, leisure: 3 },
      "2026-11-19",
      [{ id: "rent", amount: "30000", transferDate: "2026-11-20" }],
    ).fixedExpenses).toContain("클 수 없어요");
  });

  it("날짜별 가용 금액 합계가 분야 예산과 일치하고 해당 날짜 지출·이체를 반영한다", () => {
    const plan: SavedPlan = {
      id: "cards", createdAt: "", startDate: "2026-11-19",
      input: {
        amount: 300_000, endDate: "2026-11-21", outingDaysPerWeek: 5,
        priorities: { food: 1, transport: 2, leisure: 3 },
        fixedExpenses: [{ id: "rent", amount: 30_000, transferDate: "2026-11-20" }],
      },
      expenses: [{ id: "meal", date: "2026-11-20", category: "food", amount: 10_000 }],
    };
    const cards = buildDailyPlanCards(plan);
    expect(cards).toHaveLength(3);
    expect(cards.reduce((sum, card) => sum + card.availableByCategory.food, 0)).toBe(135_000);
    expect(cards[1]).toMatchObject({ fixedExpenseDue: 30_000, remainingByCategory: { food: 125_000 }, remainingBalance: 80_000 });
    expect(cards.map((card) => card.remainingBalance)).toEqual([210_000, 80_000, 0]);
  });

  it("식사 추천 한도는 그날 식비 지출과 남은 하루·총 식비를 넘지 않는다", () => {
    const plan: SavedPlan = {
      id: "meal-budget", createdAt: "", startDate: "2026-11-19",
      input: { amount: 300_000, endDate: "2026-11-21", outingDaysPerWeek: 5, priorities: { food: 1, transport: 2, leisure: 3 }, fixedExpenses: [] },
      expenses: [{ id: "today-meal", date: "2026-11-20", category: "food", amount: 2_000 }],
    };
    const card = buildDailyPlanCards(plan)[1];
    expect(dailyMealBudgetForCard(card, plan.expenses, 7_000)).toBe(7_000);
    expect(dailyMealBudgetForCard(card, plan.expenses, 20_000)).toBe(20_000);
    expect(dailyMealBudgetForCard(card, plan.expenses, 1_000_000)).toBe(48_000);
    expect(dailyMealBudgetForCard({ ...card, remainingByCategory: { ...card.remainingByCategory, food: 1_000 } }, plan.expenses, 20_000)).toBe(1_000);
  });
});
