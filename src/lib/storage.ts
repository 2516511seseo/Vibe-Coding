import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizePriorities } from "./budget";
import type { SavedPlan } from "./types";

const STORAGE_KEY = "daily-runway.active-plan.v1";

export async function loadActivePlan(): Promise<SavedPlan | null> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const plan = JSON.parse(value) as SavedPlan & { input: SavedPlan["input"] & { schoolDaysPerWeek?: number } };
    if (!plan?.input || !Array.isArray(plan.expenses) || !plan.input.priorities) return null;
    const { schoolDaysPerWeek, ...input } = plan.input;
    return {
      ...plan,
      input: {
        ...input,
        outingDaysPerWeek: input.outingDaysPerWeek ?? schoolDaysPerWeek ?? 0,
        priorities: normalizePriorities(input.priorities),
        fixedExpenses: Array.isArray(input.fixedExpenses) ? input.fixedExpenses : [],
      },
    };
  } catch {
    return null;
  }
}

export async function saveActivePlan(plan: SavedPlan) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}
