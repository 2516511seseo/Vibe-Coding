import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DateField } from "../components/DateField";
import { seoulToday, summarizePlan } from "../lib/budget";
import { loadActivePlan, saveActivePlan } from "../lib/storage";
import { CATEGORIES, CATEGORY_LABELS, type Category, type Expense, type SavedPlan } from "../lib/types";

const colors = { ink: "#22231f", muted: "#777970", line: "#e6e3dc", paper: "#fff", accent: "#526c5d", pale: "#eaf0e8", error: "#a83d36", warm: "#f4eee0" };
const ratio = (rank: number) => (rank === 1 ? "50%" : rank === 2 ? "30%" : "20%");
const won = (amount: number) => `${Math.max(0, amount).toLocaleString("ko-KR")}원`;

function askReplace() {
  if (Platform.OS === "web") return Promise.resolve(window.confirm("기존 플랜과 지출 기록을 새 플랜으로 바꿀까요?"));
  return new Promise<boolean>((resolve) => Alert.alert("기존 플랜 바꾸기", "기존 플랜과 지출 기록이 새 플랜으로 바뀝니다.", [
    { text: "취소", style: "cancel", onPress: () => resolve(false) },
    { text: "바꾸기", style: "destructive", onPress: () => resolve(true) },
  ]));
}

export default function PlanScreen() {
  const router = useRouter();
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const [plan, setPlan] = useState<SavedPlan | null>(null);
  const [saved, setSaved] = useState(false);
  const [activePlan, setActivePlan] = useState<SavedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [expenseDate, setExpenseDate] = useState(seoulToday());
  const [expenseCategory, setExpenseCategory] = useState<Category>("food");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const [message, setMessage] = useState("");
  const today = seoulToday();

  useEffect(() => {
    let parsedDraft: SavedPlan | null = null;
    if (typeof draft === "string") {
      try { parsedDraft = JSON.parse(draft) as SavedPlan; } catch { parsedDraft = null; }
    }
    loadActivePlan().then((stored) => {
      setActivePlan(stored);
      if (parsedDraft?.input && Array.isArray(parsedDraft.expenses)) {
        if (stored?.id === parsedDraft.id) {
          setPlan(stored);
          setSaved(true);
        } else {
          setPlan(parsedDraft);
          setSaved(false);
        }
      } else if (stored) {
        setPlan(stored);
        setSaved(true);
      } else {
        router.replace("/");
      }
      setLoading(false);
    });
  }, [draft, router]);

  const summary = useMemo(() => plan ? summarizePlan(plan, today) : null, [plan, today]);

  async function commitPlan(next: SavedPlan) {
    setPlan(next);
    setActivePlan(next);
    await saveActivePlan(next);
  }

  async function savePlan() {
    if (!plan) return;
    if (activePlan && activePlan.id !== plan.id && !(await askReplace())) return;
    try {
      await commitPlan(plan);
      setSaved(true);
      setMessage("플랜을 이 브라우저에 저장했어요.");
    } catch {
      setMessage("저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
    }
  }

  async function addExpense() {
    if (!plan || !saved) return;
    const amountText = expenseAmount.trim().replace(/,/g, "");
    if (!/^\d+$/.test(amountText) || Number(amountText) < 1 || !Number.isSafeInteger(Number(amountText))) {
      setExpenseError("1원 이상의 정수 금액을 입력해 주세요.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      setExpenseError("날짜를 선택해 주세요.");
      return;
    }
    const expense: Expense = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date: expenseDate, category: expenseCategory, amount: Number(amountText) };
    try {
      await commitPlan({ ...plan, expenses: [...plan.expenses, expense] });
      setExpenseAmount("");
      setExpenseError("");
      setMessage("지출을 추가하고 남은 한도를 다시 계산했어요.");
    } catch {
      setMessage("저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
    }
  }

  async function removeExpense(id: string) {
    if (!plan) return;
    try {
      await commitPlan({ ...plan, expenses: plan.expenses.filter((expense) => expense.id !== id) });
      setMessage("지출을 삭제하고 남은 한도를 다시 계산했어요.");
    } catch {
      setMessage("저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
    }
  }

  if (loading || !plan || !summary) return <View style={styles.loading}><Text style={styles.muted}>플랜을 불러오는 중이에요…</Text></View>;

  const categoryOrder = [...CATEGORIES].sort((a, b) => plan.input.priorities[a] - plan.input.priorities[b]);
  const dateChanged = plan.startDate !== today;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <View style={styles.topline}>
          <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={styles.backButton}><Text style={styles.backText}>← 다시 계산하기</Text></Pressable>
          <Text style={styles.brand}>DAILY RUNWAY</Text>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>생활비 플랜</Text>
            <Text style={styles.title}>남은 기간을 위한{`\n`}새로운 기준</Text>
            <Text style={styles.description}>{plan.startDate} 시작 · {plan.input.endDate} 종료 · 전체 {summary.totalDays}일 · 남은 {summary.remainingDays}일</Text>
          </View>
          <View style={[styles.statusBadge, saved && styles.statusSaved]}><Text style={[styles.statusText, saved && styles.statusTextSaved]}>{saved ? "저장된 플랜" : "저장 전 미리보기"}</Text></View>
        </View>

        {dateChanged ? <View style={styles.notice}><Text style={styles.noticeText}>플랜을 만든 뒤 날짜가 바뀌었어요. 오늘부터 종료일까지 남은 기간으로 한도를 다시 계산했어요.</Text></View> : null}

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statMain]}>
            <Text style={styles.statLabel}>남은 예산</Text>
            <Text style={styles.statValueLight}>{won(summary.availableAmount)}</Text>
            <Text style={styles.statSubLight}>실제 지출 {won(summary.spentTotal)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>하루 총 권장 한도</Text>
            <Text style={styles.statValue}>{won(summary.remainingDaily)}</Text>
            <Text style={styles.statSub}>남은 {summary.remainingDays}일 기준</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>등교 1일 교통 한도</Text>
            <Text style={styles.statValue}>{summary.commuteDaily === null ? "등교일 없음" : won(summary.commuteDaily)}</Text>
            <Text style={styles.statSub}>예상 등교일 {summary.expectedSchoolDays}일</Text>
          </View>
        </View>

        {summary.overBudget > 0 ? (
          <View style={styles.overBudget}><Text style={styles.overBudgetTitle}>플랜 예산을 {won(summary.overBudget)} 초과했어요.</Text><Text style={styles.overBudgetText}>남은 {summary.remainingDays}일 동안 하루 {won(summary.extraDailySavings)}씩 더 절약해야 해요.</Text></View>
        ) : summary.extraDailySavings > 0 ? (
          <View style={styles.savings}><Text style={styles.savingsText}>남은 {summary.remainingDays}일 동안 하루 {won(summary.extraDailySavings)}씩 더 절약하면 계획에 맞출 수 있어요.</Text></View>
        ) : null}

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>항목별 예산</Text><Text style={styles.sectionCaption}>1위 50% · 2위 30% · 3위 20%</Text></View>
        <View style={styles.categoryGrid}>
          {categoryOrder.map((category) => (
            <View key={category} style={styles.categoryCard}>
              <View style={styles.categoryTop}>
                <Text style={styles.categoryName}>{CATEGORY_LABELS[category]}</Text>
                <Text style={styles.categoryRank}>{plan.input.priorities[category]}위 · {ratio(plan.input.priorities[category])}</Text>
              </View>
              <View style={styles.categoryLine}><Text style={styles.categoryLabel}>플랜 금액</Text><Text style={styles.categoryAmount}>{won(summary.categoryAmounts[category])}</Text></View>
              <View style={styles.categoryLine}><Text style={styles.categoryLabel}>실제 지출</Text><Text style={styles.categoryAmount}>{won(summary.spentByCategory[category])}</Text></View>
              <View style={styles.categoryDailyBox}><Text style={styles.dailyLabel}>남은 기간 하루 한도</Text><Text style={styles.dailyAmount}>{won(summary.categoryDaily[category])}</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.infoLine}><Text style={styles.infoDot}>i</Text><Text style={styles.infoText}>등교일은 주당 평균으로 추정해요. 실제 공휴일이나 시험 일정은 반영하지 않아요.</Text></View>

        {!saved ? (
          <Pressable accessibilityRole="button" onPress={savePlan} style={styles.primaryButton}><Text style={styles.primaryButtonText}>이 플랜 저장하기</Text><Text style={styles.buttonArrow}>→</Text></Pressable>
        ) : (
          <>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>실제 지출 기록</Text><Text style={styles.sectionCaption}>기록 즉시 저장돼요</Text></View>
            <View style={styles.expenseForm}>
              <View style={styles.expenseField}>
                <Text style={styles.smallLabel}>날짜</Text>
                <DateField accessibilityLabel="지출 날짜" value={expenseDate} onChange={setExpenseDate} min="2000-01-01" max="2100-12-31" />
              </View>
              <View style={styles.expenseField}>
                <Text style={styles.smallLabel}>항목</Text>
                <View style={styles.categoryChoices}>{CATEGORIES.map((category) => (
                  <Pressable key={category} accessibilityRole="button" accessibilityState={{ selected: expenseCategory === category }} onPress={() => setExpenseCategory(category)} style={[styles.categoryChoice, expenseCategory === category && styles.categoryChoiceSelected]}>
                    <Text style={[styles.choiceText, expenseCategory === category && styles.choiceTextSelected]}>{CATEGORY_LABELS[category]}</Text>
                  </Pressable>
                ))}</View>
              </View>
              <View style={styles.expenseField}>
                <Text style={styles.smallLabel}>금액</Text>
                <View style={styles.amountInputWrap}><TextInput accessibilityLabel="지출 금액" value={expenseAmount} onChangeText={setExpenseAmount} placeholder="금액 입력" keyboardType="number-pad" style={styles.expenseAmountInput} /><Text style={styles.muted}>원</Text></View>
              </View>
              {expenseError ? <Text accessibilityRole="alert" style={styles.error}>{expenseError}</Text> : null}
              <Pressable accessibilityRole="button" onPress={addExpense} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>지출 추가</Text><Text style={styles.secondaryArrow}>＋</Text></Pressable>
            </View>

            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>지출 목록</Text><Text style={styles.sectionCaption}>{plan.expenses.length}건 · 합계 {won(summary.spentTotal)}</Text></View>
            {plan.expenses.length ? [...plan.expenses].sort((a, b) => b.date.localeCompare(a.date)).map((expense) => (
              <View key={expense.id} style={styles.expenseRow}>
                <View style={styles.expenseInfo}><Text style={styles.expenseName}>{CATEGORY_LABELS[expense.category]}</Text><Text style={styles.expenseDate}>{expense.date}</Text></View>
                <Text style={styles.expenseValue}>{won(expense.amount)}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`${CATEGORY_LABELS[expense.category]} ${won(expense.amount)} 기록 삭제`} onPress={() => removeExpense(expense.id)} style={styles.deleteButton}><Text style={styles.deleteText}>삭제</Text></Pressable>
              </View>
            )) : <View style={styles.emptyExpenses}><Text style={styles.emptyText}>아직 기록한 지출이 없어요.</Text></View>}
          </>
        )}

        {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
        <Text style={styles.footer}>이 금액은 평균 권장 예산이에요. 필수 비용을 보장하거나 실제 지출을 자동으로 알아내지 않아요. 플랜과 지출 기록은 이 브라우저에만 저장돼요.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f7f6f2" },
  pageContent: { paddingHorizontal: 20, paddingBottom: 60 },
  container: { width: "100%", maxWidth: 1040, alignSelf: "center" },
  loading: { flex: 1, minHeight: 300, justifyContent: "center", alignItems: "center", backgroundColor: "#f7f6f2" },
  topline: { height: 76, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: colors.line },
  backButton: { paddingVertical: 10, paddingRight: 12 },
  backText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  brand: { color: colors.ink, fontSize: 12, letterSpacing: 2.2, fontWeight: "800" },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  hero: { paddingTop: 42, paddingBottom: 28 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, marginBottom: 12 },
  title: { color: colors.ink, fontSize: 36, lineHeight: 43, letterSpacing: -1.1, fontWeight: "700" },
  description: { color: colors.muted, fontSize: 13, marginTop: 13 },
  statusBadge: { backgroundColor: colors.warm, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, marginTop: 42 },
  statusSaved: { backgroundColor: colors.pale },
  statusText: { fontSize: 11, fontWeight: "700", color: "#826b3b" },
  statusTextSaved: { color: colors.accent },
  notice: { backgroundColor: colors.warm, borderRadius: 12, padding: 14, marginBottom: 16 },
  noticeText: { color: "#6d5a36", fontSize: 13, lineHeight: 20 },
  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 34, flexWrap: "wrap" },
  statCard: { flexGrow: 1, flexBasis: 210, minHeight: 134, padding: 20, borderRadius: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, justifyContent: "center" },
  statMain: { backgroundColor: colors.ink, borderColor: colors.ink },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  statValue: { color: colors.ink, fontSize: 23, fontWeight: "700", marginTop: 10, letterSpacing: -0.5 },
  statValueLight: { color: "#fff", fontSize: 25, fontWeight: "700", marginTop: 10, letterSpacing: -0.5 },
  statSub: { color: colors.muted, fontSize: 11, marginTop: 8 },
  statSubLight: { color: "#c4c8c0", fontSize: 11, marginTop: 8 },
  overBudget: { backgroundColor: "#faebe8", borderWidth: 1, borderColor: "#eed2cc", borderRadius: 14, padding: 17, marginTop: -14, marginBottom: 30 },
  overBudgetTitle: { color: colors.error, fontSize: 14, fontWeight: "700" },
  overBudgetText: { color: colors.ink, fontSize: 13, marginTop: 6 },
  savings: { backgroundColor: colors.pale, borderRadius: 14, padding: 16, marginTop: -14, marginBottom: 30 },
  savingsText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, marginTop: 6 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  sectionCaption: { color: colors.muted, fontSize: 11 },
  categoryGrid: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 12 },
  categoryCard: { flexGrow: 1, flexBasis: 235, backgroundColor: colors.paper, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 18 },
  categoryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, borderBottomWidth: 1, borderColor: colors.line, marginBottom: 12 },
  categoryName: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  categoryRank: { color: colors.accent, fontSize: 11, fontWeight: "700" },
  categoryLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 9 },
  categoryLabel: { color: colors.muted, fontSize: 12 },
  categoryAmount: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  categoryDailyBox: { backgroundColor: "#f7f6f2", borderRadius: 10, padding: 11, marginTop: 7, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dailyLabel: { color: colors.muted, fontSize: 11 },
  dailyAmount: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  infoLine: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 28 },
  infoDot: { color: colors.accent, fontWeight: "700", fontSize: 12, borderWidth: 1, borderColor: "#bdcabe", borderRadius: 99, width: 18, height: 18, textAlign: "center", lineHeight: 16 },
  infoText: { color: colors.muted, fontSize: 11, flexShrink: 1 },
  primaryButton: { height: 58, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.ink, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  buttonArrow: { color: "#fff", fontSize: 20 },
  expenseForm: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 18, marginBottom: 30 },
  expenseField: { marginBottom: 14 },
  smallLabel: { color: colors.ink, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  categoryChoices: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  categoryChoice: { paddingHorizontal: 14, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.line, justifyContent: "center" },
  categoryChoiceSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  choiceText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  choiceTextSelected: { color: "#fff" },
  amountInputWrap: { height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" },
  expenseAmountInput: { height: "100%", flex: 1, color: colors.ink, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 12 },
  error: { color: colors.error, fontSize: 12, marginBottom: 12 },
  secondaryButton: { height: 48, backgroundColor: colors.pale, borderRadius: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  secondaryButtonText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  secondaryArrow: { color: colors.accent, fontSize: 18 },
  expenseRow: { minHeight: 62, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderColor: colors.line, gap: 12 },
  expenseInfo: { flex: 1 },
  expenseName: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  expenseDate: { color: colors.muted, fontSize: 11, marginTop: 4 },
  expenseValue: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  deleteButton: { paddingHorizontal: 9, paddingVertical: 8 },
  deleteText: { color: colors.muted, fontSize: 11 },
  emptyExpenses: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 20, marginBottom: 12 },
  emptyText: { color: colors.muted, fontSize: 12, textAlign: "center" },
  message: { color: colors.accent, fontSize: 12, marginTop: 8, marginBottom: 10 },
  footer: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: "center", marginTop: 28 },
});
