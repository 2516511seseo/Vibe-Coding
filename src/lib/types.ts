export type Category = "food" | "transport" | "leisure";
export type Priorities = Record<Category, 1 | 2 | 3>;

export type PlanInput = {
  amount: number;
  endDate: string;
  schoolDaysPerWeek: number;
  priorities: Priorities;
};

export type FormValues = {
  amount: string;
  endDate: string;
  schoolDaysPerWeek: string;
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
  expectedSchoolDays: number;
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
  commuteDaily: number | null;
};

export const CATEGORIES: Category[] = ["food", "transport", "leisure"];
export const CATEGORY_LABELS: Record<Category, string> = {
  food: "식비",
  transport: "교통비",
  leisure: "여가비",
};
