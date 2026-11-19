import {
  CATEGORIES,
  type Category,
  type FormValues,
  type PlanInput,
  type PlanSummary,
  type Priorities,
  type SavedPlan,
} from "./types";

const DAY = 86_400_000;
export const DEFAULT_PRIORITIES: Priorities = { food: 1, transport: 2, leisure: 3 };

export function seoulToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function dateOrdinal(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const ordinal = Date.UTC(year, month - 1, day);
  const date = new Date(ordinal);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return ordinal;
}

export function daysInclusive(start: string, end: string) {
  const a = dateOrdinal(start);
  const b = dateOrdinal(end);
  return a === null || b === null || b < a ? 0 : Math.floor((b - a) / DAY) + 1;
}

export function validateForm(values: FormValues, priorities: Priorities, today = seoulToday()) {
  const errors: Partial<Record<keyof FormValues | "priorities", string>> = {};
  const amountText = values.amount.trim().replace(/,/g, "");
  if (!amountText) errors.amount = "세 항목에 나눌 금액을 입력해 주세요.";
  else if (!/^\d+$/.test(amountText) || Number(amountText) < 1) errors.amount = "1원 이상의 정수 금액을 입력해 주세요.";
  else if (Number(amountText) > 100_000_000) errors.amount = "1억 원 이하로 입력해 주세요.";

  if (!values.endDate) errors.endDate = "언제까지 사용할지 날짜를 선택해 주세요.";
  else {
    const selected = dateOrdinal(values.endDate);
    const current = dateOrdinal(today);
    if (selected === null) errors.endDate = "날짜를 YYYY-MM-DD 형식으로 선택해 주세요.";
    else if (current !== null && selected < current) errors.endDate = "오늘 또는 그 이후 날짜를 선택해 주세요.";
    else if (current !== null && selected > current + 365 * DAY) errors.endDate = "오늘부터 365일 이내의 날짜를 선택해 주세요.";
  }

  if (values.schoolDaysPerWeek === "" || !/^\d+$/.test(values.schoolDaysPerWeek) || Number(values.schoolDaysPerWeek) > 7) {
    errors.schoolDaysPerWeek = "주당 등교일수를 0~7 사이 정수로 입력해 주세요.";
  }
  if (new Set(CATEGORIES.map((category) => priorities[category])).size !== 3) {
    errors.priorities = "각 항목의 순위를 1·2·3위로 설정해 주세요.";
  }
  return errors;
}

export function normalizeForm(values: FormValues, priorities: Priorities): PlanInput {
  return {
    amount: Number(values.amount.trim().replace(/,/g, "")),
    endDate: values.endDate,
    schoolDaysPerWeek: Number(values.schoolDaysPerWeek),
    priorities: { ...priorities },
  };
}

export function swapPriority(priorities: Priorities, category: Category, rank: 1 | 2 | 3): Priorities {
  const other = CATEGORIES.find((item) => item !== category && priorities[item] === rank);
  return other ? { ...priorities, [category]: rank, [other]: priorities[category] } : priorities;
}

export function allocateAmount(amount: number, priorities: Priorities) {
  const result = {} as Record<Category, number>;
  for (const category of CATEGORIES) {
    const percent = priorities[category] === 1 ? 50 : priorities[category] === 2 ? 30 : 20;
    result[category] = Math.floor((amount * percent) / 100);
  }
  const third = CATEGORIES.find((category) => priorities[category] === 3)!;
  result[third] += amount - Object.values(result).reduce((sum, value) => sum + value, 0);
  return result;
}

export function createPlan(input: PlanInput, now = new Date()): SavedPlan {
  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now.toISOString(),
    startDate: seoulToday(now),
    input,
    expenses: [],
  };
}

export function summarizePlan(plan: SavedPlan, today = seoulToday()): PlanSummary {
  const { amount, endDate, schoolDaysPerWeek, priorities } = plan.input;
  const totalDays = daysInclusive(plan.startDate, endDate);
  const remainingDays = daysInclusive(today, endDate);
  const categoryAmounts = allocateAmount(amount, priorities);
  const spentByCategory = { food: 0, transport: 0, leisure: 0 };
  for (const expense of plan.expenses) spentByCategory[expense.category] += expense.amount;
  const spentTotal = Object.values(spentByCategory).reduce((sum, value) => sum + value, 0);
  const remainingAmount = amount - spentTotal;
  const availableAmount = Math.max(0, remainingAmount);
  const overBudget = Math.max(0, -remainingAmount);
  const plannedDaily = totalDays ? Math.floor(amount / totalDays) : 0;
  const remainingDaily = remainingDays ? Math.floor(availableAmount / remainingDays) : 0;
  const extraDailySavings = Math.max(0, plannedDaily - remainingDaily);
  const categoryDaily = {} as Record<Category, number>;
  for (const category of CATEGORIES) categoryDaily[category] = totalDays ? Math.floor(categoryAmounts[category] / totalDays) : 0;
  const third = CATEGORIES.find((category) => priorities[category] === 3)!;
  categoryDaily[third] += Math.max(0, plannedDaily - Object.values(categoryDaily).reduce((sum, value) => sum + value, 0));

  let reduction = Math.max(0, plannedDaily - remainingDaily);
  for (const category of [...CATEGORIES].sort((a, b) => priorities[b] - priorities[a])) {
    const cut = Math.min(categoryDaily[category], reduction);
    categoryDaily[category] -= cut;
    reduction -= cut;
  }

  const expectedSchoolDays = Math.round((remainingDays * schoolDaysPerWeek) / 7);
  const transportReduction = Math.max(0, (totalDays ? Math.floor(categoryAmounts.transport / totalDays) : 0) - categoryDaily.transport) * remainingDays;
  const remainingTransport = Math.max(0, categoryAmounts.transport - spentByCategory.transport - transportReduction);
  const commuteDaily = expectedSchoolDays ? Math.floor(remainingTransport / expectedSchoolDays) : null;

  return {
    totalDays,
    remainingDays,
    expectedSchoolDays,
    plannedDaily,
    remainingAmount,
    availableAmount,
    overBudget,
    spentTotal,
    remainingDaily,
    extraDailySavings,
    categoryAmounts,
    spentByCategory,
    categoryDaily,
    commuteDaily,
  };
}
