import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizePriorities } from "./budget";
import type { SavedPlan } from "./types";

const STORAGE_KEY = "daily-runway.active-plan.v1";
const ACCOUNTS_KEY = "daily-runway.plan-accounts.v1";
const ACTIVE_ACCOUNT_KEY = "daily-runway.active-account.v1";
const PENDING_PLAN_KEY = "daily-runway.pending-plan.v1";

type PlanAccount = { nickname: string; salt: string; pinHash: string; plan: SavedPlan };

async function readAccounts(): Promise<PlanAccount[]> {
  try {
    const value = await AsyncStorage.getItem(ACCOUNTS_KEY);
    const accounts = value ? JSON.parse(value) as PlanAccount[] : [];
    return Array.isArray(accounts) ? accounts : [];
  } catch { return []; }
}

async function hashPin(nickname: string, pin: string, salt: string) {
  if (!globalThis.crypto?.subtle) throw new Error("이 브라우저에서는 PIN 저장을 지원하지 않아요.");
  const bytes = new TextEncoder().encode(`${salt}:${nickname.trim().toLocaleLowerCase("ko-KR")}:${pin}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newSalt() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

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
  const nickname = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
  if (!nickname) return;
  const accounts = await readAccounts();
  const index = accounts.findIndex((account) => account.nickname.toLocaleLowerCase("ko-KR") === nickname.toLocaleLowerCase("ko-KR"));
  if (index >= 0) {
    accounts[index] = { ...accounts[index], plan };
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }
}

export async function savePendingPlan(plan: SavedPlan | null) {
  if (plan) await AsyncStorage.setItem(PENDING_PLAN_KEY, JSON.stringify(plan));
  else await AsyncStorage.removeItem(PENDING_PLAN_KEY);
}

export async function loadPendingPlan(): Promise<SavedPlan | null> {
  try {
    const value = await AsyncStorage.getItem(PENDING_PLAN_KEY);
    return value ? JSON.parse(value) as SavedPlan : null;
  } catch { return null; }
}

export async function createPlanAccount(nicknameValue: string, pin: string, plan: SavedPlan) {
  const nickname = nicknameValue.trim();
  if (!nickname || nickname.length > 24) throw new Error("닉네임은 1~24자로 입력해 주세요.");
  if (!/^\d{4}$/.test(pin)) throw new Error("비밀번호는 숫자 4자리로 입력해 주세요.");
  const accounts = await readAccounts();
  if (accounts.some((account) => account.nickname.toLocaleLowerCase("ko-KR") === nickname.toLocaleLowerCase("ko-KR"))) {
    throw new Error("이미 사용 중인 닉네임이에요. 다른 닉네임을 골라 주세요.");
  }
  const salt = newSalt();
  accounts.push({ nickname, salt, pinHash: await hashPin(nickname, pin, salt), plan });
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, nickname);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  await AsyncStorage.removeItem(PENDING_PLAN_KEY);
}

export async function restorePlanAccount(nicknameValue: string, pin: string) {
  const nickname = nicknameValue.trim();
  if (!nickname || !/^\d{4}$/.test(pin)) throw new Error("닉네임과 숫자 4자리 비밀번호를 확인해 주세요.");
  const account = (await readAccounts()).find((item) => item.nickname.toLocaleLowerCase("ko-KR") === nickname.toLocaleLowerCase("ko-KR"));
  if (!account || await hashPin(account.nickname, pin, account.salt) !== account.pinHash) {
    throw new Error("닉네임이나 비밀번호가 맞지 않아요.");
  }
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, account.nickname);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(account.plan));
  return account.plan;
}
