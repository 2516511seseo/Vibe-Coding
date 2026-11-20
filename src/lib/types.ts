export type Category = "food" | "transport" | "leisure";
export type Priorities = Record<Category, number>;

export type FixedExpense = {
  id: string;
  amount: number;
  transferDate: string;
};

export type PlanInput = {
  amount: number;
  endDate: string;
  outingDaysPerWeek: number;
  priorities: Priorities;
  fixedExpenses: FixedExpense[];
};

export type FixedExpenseDraft = {
  id: string;
  amount: string;
  transferDate: string;
};

export type FormValues = {
  amount: string;
  endDate: string;
  outingDaysPerWeek: string;
};

export type Expense = {
  id: string;
  date: string;
  category: Category;
  amount: number;
};

export type SavedPlan = {
  id: string;
  createdAt: string;
  startDate: string;
  input: PlanInput;
  expenses: Expense[];
};

export type PlanSummary = {
  totalDays: number;
  remainingDays: number;
  expectedOutingDays: number;
  plannedDaily: number;
  remainingAmount: number;
  availableAmount: number;
  overBudget: number;
  spentTotal: number;
  remainingDaily: number;
  extraDailySavings: number;
  categoryAmounts: Record<Category, number>;
  spentByCategory: Record<Category, number>;
  categoryDaily: Record<Category, number>;
  transportPerOutingDay: number | null;
};

export type DailyPlanCard = {
  date: string;
  availableByCategory: Record<Category, number>;
  remainingByCategory: Record<Category, number>;
  fixedExpenseDue: number;
  remainingBalance: number;
};

export const CATEGORIES: Category[] = ["food", "transport", "leisure"];
export const CATEGORY_LABELS: Record<Category, string> = {
  food: "식비",
  transport: "교통비",
  leisure: "여가비",
};
