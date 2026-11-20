import {
  CATEGORIES,
  type Category,
  type FormValues,
  type FixedExpense,
  type FixedExpenseDraft,
  type DailyPlanCard,
  type Expense,
  type PlanInput,
  type PlanSummary,
  type Priorities,
  type SavedPlan,
} from "./types";

const DAY = 86_400_000;
export const DEFAULT_PRIORITIES: Priorities = { food: 50, transport: 30, leisure: 20 };

export function normalizePriorities(value: unknown): Priorities {
  if (!value || typeof value !== "object") return { ...DEFAULT_PRIORITIES };
  const source = value as Record<Category, unknown>;
  const values = CATEGORIES.map((category) => source[category]);
  if (values.every((item) => Number.isSafeInteger(item) && Number(item) >= 0 && Number(item) <= 100) && values.reduce<number>((sum, item) => sum + Number(item), 0) === 100) {
    return { food: Number(source.food), transport: Number(source.transport), leisure: Number(source.leisure) };
  }
  if (values.every((item) => item === 1 || item === 2 || item === 3) && new Set(values).size === 3) {
    const percentageForRank = { 1: 50, 2: 30, 3: 20 } as const;
    return {
      food: percentageForRank[Number(source.food) as 1 | 2 | 3],
      transport: percentageForRank[Number(source.transport) as 1 | 2 | 3],
      leisure: percentageForRank[Number(source.leisure) as 1 | 2 | 3],
    };
  }
  return { ...DEFAULT_PRIORITIES };
}

export function setPriorityPercent(priorities: Priorities, category: Category, requestedPercent: number): Priorities {
  const current = normalizePriorities(priorities);
  const percent = Math.max(0, Math.min(100, Math.round(requestedPercent)));
  const remainder = 100 - percent;
  const others = CATEGORIES.filter((item) => item !== category);
  const firstOtherCategory = others[0]!;
  const secondOtherCategory = others[1]!;
  const previousTotal = current[firstOtherCategory] + current[secondOtherCategory];
  const firstOtherPercent = previousTotal > 0
    ? Math.round((remainder * current[firstOtherCategory]) / previousTotal)
    : Math.floor(remainder / 2);
  return {
    ...current,
    [category]: percent,
    [firstOtherCategory]: firstOtherPercent,
    [secondOtherCategory]: remainder - firstOtherPercent,
  };
}

function hasValidPriorities(priorities: Priorities) {
  const values = CATEGORIES.map((category) => priorities[category]);
  const validPercentages = values.every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 100)
    && values.reduce((sum, value) => sum + value, 0) === 100;
  const validLegacyRanks = values.every((value) => value === 1 || value === 2 || value === 3) && new Set(values).size === 3;
  return validPercentages || validLegacyRanks;
}

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

  if (values.outingDaysPerWeek === "" || !/^\d+$/.test(values.outingDaysPerWeek) || Number(values.outingDaysPerWeek) > 7) {
    errors.outingDaysPerWeek = "주당 외출일수를 0~7 사이 정수로 입력해 주세요.";
  }
  if (!hasValidPriorities(priorities)) {
    errors.priorities = "분야별 비율의 합계가 100%가 되도록 조절해 주세요.";
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
    outingDaysPerWeek: Number(values.outingDaysPerWeek),
    priorities: normalizePriorities(priorities),
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
  const percentages = normalizePriorities(priorities);
  const result = {} as Record<Category, number>;
  for (const category of CATEGORIES) {
    result[category] = Math.floor((amount * percentages[category]) / 100);
  }
  const first = [...CATEGORIES].sort((a, b) => percentages[b] - percentages[a])[0]!;
  result[first] += amount - Object.values(result).reduce((sum, value) => sum + value, 0);
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

  let allocatedThroughDate = 0;
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
    allocatedThroughDate += dailyAvailable;
    return {
      date,
      availableByCategory,
      remainingByCategory,
      fixedExpenseDue: fixedByDate.get(date) ?? 0,
      remainingBalance: Math.max(0, plan.input.amount - fixedPaidToDate - spentToDate - allocatedThroughDate),
    };
  });
}

export function dailyMealBudgetForCard(card: DailyPlanCard, expenses: Expense[], remainingDailyFood: number) {
  const spentOnDate = expenses
    .filter((expense) => expense.category === "food" && expense.date === card.date)
    .reduce((sum, expense) => sum + expense.amount, 0);
  return Math.max(0, Math.min(
    card.availableByCategory.food - spentOnDate,
    card.remainingByCategory.food,
    remainingDailyFood,
  ));
}

export function summarizePlan(plan: SavedPlan, today = seoulToday()): PlanSummary {
  const { amount, endDate, outingDaysPerWeek } = plan.input;
  const priorities = normalizePriorities(plan.input.priorities);
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
  const first = [...CATEGORIES].sort((a, b) => priorities[b] - priorities[a])[0]!;
  categoryDaily[first] += Math.max(0, plannedDaily - Object.values(categoryDaily).reduce((sum, value) => sum + value, 0));

  let reduction = Math.max(0, plannedDaily - remainingDaily);
  for (const category of [...CATEGORIES].sort((a, b) => priorities[b] - priorities[a])) {
    const cut = Math.min(categoryDaily[category], reduction);
    categoryDaily[category] -= cut;
    reduction -= cut;
  }

  const expectedOutingDays = Math.round((remainingDays * outingDaysPerWeek) / 7);
  const transportReduction = Math.max(0, (totalDays ? Math.floor(categoryAmounts.transport / totalDays) : 0) - categoryDaily.transport) * remainingDays;
  const remainingTransport = Math.max(0, categoryAmounts.transport - spentByCategory.transport - transportReduction);
  const transportPerOutingDay = expectedOutingDays ? Math.floor(remainingTransport / expectedOutingDays) : null;

  return {
    totalDays,
    remainingDays,
    expectedOutingDays,
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
    transportPerOutingDay,
  };
}
