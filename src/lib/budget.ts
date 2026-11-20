import {
  CATEGORIES,
  type Category,
  type FormValues,
  type FixedExpense,
  type FixedExpenseDraft,
  type DailyPlanCard,
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

export function validateForm(
  values: FormValues,
  priorities: Priorities,
  today = seoulToday(),
  fixedExpenses: FixedExpenseDraft[] = [],
) {
  const errors: Partial<Record<keyof FormValues | "priorities" | "fixedExpenses", string>> = {};
  const amountText = values.amount.trim().replace(/,/g, "");
  if (!amountText) errors.amount = "고정지출을 포함한 전체 생활비를 입력해 주세요.";
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

  const wholeAmount = /^\d+$/.test(amountText) ? Number(amountText) : 0;
  let fixedTotal = 0;
  for (const item of fixedExpenses) {
    const fixedText = item.amount.trim().replace(/,/g, "");
    if (!/^\d+$/.test(fixedText) || Number(fixedText) < 1 || !Number.isSafeInteger(Number(fixedText))) {
      errors.fixedExpenses = "고정지출마다 1원 이상의 정수 금액을 입력해 주세요.";
      break;
    }
    fixedTotal += Number(fixedText);
    const transfer = dateOrdinal(item.transferDate);
    const current = dateOrdinal(today);
    const end = dateOrdinal(values.endDate);
    if (transfer === null || current === null || transfer < current || (end !== null && transfer > end)) {
      errors.fixedExpenses = "고정지출 이체일은 오늘부터 플랜 종료일까지로 선택해 주세요.";
    }
  }
  if (!errors.fixedExpenses && fixedTotal > wholeAmount) {
    errors.fixedExpenses = "고정지출 합계가 전체 생활비보다 클 수 없어요.";
  }
  return errors;
}

export function normalizeForm(values: FormValues, priorities: Priorities, fixedExpenses: FixedExpenseDraft[] = []): PlanInput {
  return {
    amount: Number(values.amount.trim().replace(/,/g, "")),
    endDate: values.endDate,
    schoolDaysPerWeek: Number(values.schoolDaysPerWeek),
    priorities: { ...priorities },
    fixedExpenses: fixedExpenses.map((item) => ({
      id: item.id,
      amount: Number(item.amount.trim().replace(/,/g, "")),
      transferDate: item.transferDate,
    })),
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

export function dateRange(start: string, end: string): string[] {
  const first = dateOrdinal(start);
  const last = dateOrdinal(end);
  if (first === null || last === null || last < first) return [];
  const dates: string[] = [];
  for (let day = first; day <= last; day += DAY) dates.push(new Date(day).toISOString().slice(0, 10));
  return dates;
}

export function buildDailyPlanCards(plan: SavedPlan): DailyPlanCard[] {
  const fixedExpenses = plan.input.fixedExpenses ?? [];
  const dates = dateRange(plan.startDate, plan.input.endDate);
  const categoryAmounts = allocateAmount(
    Math.max(0, plan.input.amount - fixedExpenses.reduce((sum, item) => sum + item.amount, 0)),
    plan.input.priorities,
  );
  const fixedByDate = new Map<string, number>();
  for (const item of fixedExpenses) fixedByDate.set(item.transferDate, (fixedByDate.get(item.transferDate) ?? 0) + item.amount);

  return dates.map((date, index) => {
    const availableByCategory = {} as DailyPlanCard["availableByCategory"];
    const remainingByCategory = {} as DailyPlanCard["remainingByCategory"];
    for (const category of CATEGORIES) {
      const total = categoryAmounts[category];
      const perDay = Math.floor(total / dates.length);
      const remainder = total % dates.length;
      availableByCategory[category] = perDay + (index < remainder ? 1 : 0);
      const spentToDate = plan.expenses
        .filter((expense) => expense.category === category && expense.date <= date)
        .reduce((sum, expense) => sum + expense.amount, 0);
      remainingByCategory[category] = Math.max(0, total - spentToDate);
    }
    const fixedPaidToDate = fixedExpenses
      .filter((item) => item.transferDate <= date)
      .reduce((sum, item) => sum + item.amount, 0);
    const spentToDate = plan.expenses
      .filter((expense) => expense.date <= date)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const dailyAvailable = Object.values(availableByCategory).reduce((sum, value) => sum + value, 0);
    return {
      date,
      availableByCategory,
      remainingByCategory,
      fixedExpenseDue: fixedByDate.get(date) ?? 0,
      remainingBalance: plan.input.amount - fixedPaidToDate - spentToDate - dailyAvailable,
    };
  });
}

export function summarizePlan(plan: SavedPlan, today = seoulToday()): PlanSummary {
  const { amount, endDate, schoolDaysPerWeek, priorities } = plan.input;
  const fixedTotal = (plan.input.fixedExpenses ?? []).reduce((sum, item) => sum + item.amount, 0);
  const flexibleAmount = Math.max(0, amount - fixedTotal);
  const totalDays = daysInclusive(plan.startDate, endDate);
  const remainingDays = daysInclusive(today, endDate);
  const categoryAmounts = allocateAmount(flexibleAmount, priorities);
  const spentByCategory = { food: 0, transport: 0, leisure: 0 };
  for (const expense of plan.expenses) spentByCategory[expense.category] += expense.amount;
  const spentTotal = Object.values(spentByCategory).reduce((sum, value) => sum + value, 0);
  const remainingAmount = flexibleAmount - spentTotal;
  const availableAmount = Math.max(0, remainingAmount);
  const overBudget = Math.max(0, -remainingAmount);
  const plannedDaily = totalDays ? Math.floor(flexibleAmount / totalDays) : 0;
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
