import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DateField } from "../components/DateField";
import { buildDailyPlanCards, dailyMealBudgetForCard, dateRange, normalizePriorities, seoulToday, summarizePlan } from "../lib/budget";
import { loadActivePlan, saveActivePlan } from "../lib/storage";
import { MEAL_FILTERS, MEAL_GROUP_LABELS, MEAL_MENU, type MealFilter } from "../lib/meals";
import type { Metadata } from "expo-router/server";
import { CATEGORIES, CATEGORY_LABELS, type Category, type DailyPlanCard, type Expense, type SavedPlan } from "../lib/types";

const colors = { ink: "#22231f", muted: "#777970", line: "#e6e3dc", paper: "#fff", accent: "#526c5d", pale: "#eaf0e8", error: "#a83d36", warm: "#f4eee0" };
const won = (amount: number) => `${Math.max(0, amount).toLocaleString("ko-KR")}원`;
const cardDateLabel = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

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
  const [mealFilter, setMealFilter] = useState<MealFilter>("all");
  const [mealSearch, setMealSearch] = useState("");
  const [mealBudgetOnly, setMealBudgetOnly] = useState(false);
  const [mealSelectionsByDate, setMealSelectionsByDate] = useState<Record<string, string[]>>({});
  const today = seoulToday();
  const [selectedDate, setSelectedDate] = useState(today);
  const [dateViewportWidth, setDateViewportWidth] = useState(0);
  const dateCardsRef = useRef<ScrollViewInstance | null>(null);

  useEffect(() => {
    let parsedDraft: SavedPlan | null = null;
    if (typeof draft === "string") {
      try { parsedDraft = JSON.parse(draft) as SavedPlan; } catch { parsedDraft = null; }
    }
    loadActivePlan().then((stored) => {
      setActivePlan(stored);
      if (parsedDraft?.input && Array.isArray(parsedDraft.expenses)) {
        parsedDraft.input = {
          ...parsedDraft.input,
          priorities: normalizePriorities(parsedDraft.input.priorities),
          fixedExpenses: Array.isArray(parsedDraft.input.fixedExpenses) ? parsedDraft.input.fixedExpenses : [],
        };
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
  const dailyCards = useMemo(() => plan ? buildDailyPlanCards(plan) : [], [plan]);
  const selectedCard = dailyCards.find((card) => card.date === selectedDate) ?? dailyCards[0] ?? null;
  const selectedIndex = selectedCard ? dailyCards.findIndex((card) => card.date === selectedCard.date) : 0;
  const mealBudget = selectedCard && summary && plan
    ? dailyMealBudgetForCard(selectedCard, plan.expenses, summary.categoryDaily.food)
    : 0;
  const selectedMealIds = selectedCard ? mealSelectionsByDate[selectedCard.date] ?? [] : [];
  const selectedMeals = MEAL_MENU.filter((item) => selectedMealIds.includes(item.id));
  const selectedMealTotal = selectedMeals.reduce((sum, item) => sum + item.price, 0);
  const mealOverBudget = Math.max(0, selectedMealTotal - mealBudget);
  const visibleMeals = MEAL_MENU.filter((item) => {
    const matchesGroup = mealFilter === "all" || item.group === mealFilter;
    const search = mealSearch.trim().toLocaleLowerCase("ko-KR");
    const matchesSearch = !search || `${item.name} ${item.description} ${MEAL_GROUP_LABELS[item.group]}`.toLocaleLowerCase("ko-KR").includes(search);
    return matchesGroup && matchesSearch && (!mealBudgetOnly || item.price <= mealBudget);
  });

  useEffect(() => {
    if (!dailyCards.length) return;
    const dates = dailyCards.map((card) => card.date);
    setSelectedDate(dates.includes(today) ? today : today < dates[0] ? dates[0] : dates[dates.length - 1]);
  }, [plan?.id, today, dailyCards.length]);

  useEffect(() => {
    if (!dateViewportWidth || !selectedCard) return;
    const cardWidth = 290;
    const gap = 10;
    const offset = Math.max(0, selectedIndex * (cardWidth + gap) - (dateViewportWidth - cardWidth) / 2);
    dateCardsRef.current?.scrollTo({ x: offset, animated: false });
  }, [selectedIndex, dateViewportWidth, selectedCard]);

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

  function toggleMeal(id: string) {
    if (!selectedCard) return;
    const date = selectedCard.date;
    setMealSelectionsByDate((current) => {
      const selected = current[date] ?? [];
      const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
      return { ...current, [date]: next };
    });
  }

  if (loading || !plan || !summary) return <View style={styles.loading}><Text style={styles.muted}>플랜을 불러오는 중이에요…</Text></View>;

  const categoryOrder = [...CATEGORIES].sort((a, b) => plan.input.priorities[b] - plan.input.priorities[a]);
  const planDates = dateRange(plan.startDate, plan.input.endDate);
  const currentDateOutsidePlan = !planDates.includes(today);
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

        <View style={styles.dateSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>날짜별 생활비</Text>
              <Text style={styles.dateSectionCaption}>날짜 카드를 눌러 그날의 예산을 확인해요.</Text>
            </View>
            {currentDateOutsidePlan ? <Text style={styles.dateOutsideNote}>플랜 기간 밖</Text> : null}
          </View>
          <ScrollView
            ref={dateCardsRef}
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={styles.dateCardsRow}
            onLayout={(event) => setDateViewportWidth(event.nativeEvent.layout.width)}
          >
            {dailyCards.map((card) => (
              <DailyBudgetCard
                key={card.date}
                card={card}
                selected={card.date === selectedCard?.date}
                isToday={card.date === today}
                onPress={() => setSelectedDate(card.date)}
              />
            ))}
          </ScrollView>
          {currentDateOutsidePlan ? <Text style={styles.dateRangeHint}>오늘이 플랜 기간에 포함되지 않아 가장 가까운 플랜 날짜를 보여주고 있어요.</Text> : null}
        </View>

        <View style={styles.mealPanel}>
          <View style={styles.mealSummary}>
            <Text style={styles.mealEyebrow}>오늘의 식단 시뮬레이터</Text>
            <View style={styles.mealSummaryLine}>
              <Text style={styles.mealSummaryText}>담은 메뉴 {selectedMeals.length}개 · 합계 {won(selectedMealTotal)}</Text>
              <Text style={styles.mealBudgetText}>선택 날짜 남은 식비 {won(mealBudget)}</Text>
            </View>
            <Text style={[styles.mealStatus, mealOverBudget > 0 && styles.mealStatusOver]}>
              {selectedMeals.length === 0 ? "메뉴를 담아 오늘 식비를 시뮬레이션해 보세요." : mealOverBudget > 0 ? `식비 한도를 ${won(mealOverBudget)} 넘었어요.` : "선택한 메뉴가 식비 한도 안에 있어요."}
            </Text>
          </View>
          <Text style={styles.mealIntro}>마음에 드는 메뉴를 담아 오늘 예산 안에서 조합해 보세요. 선택한 메뉴는 실제 지출로 저장되지 않아요.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealFilters}>
            {MEAL_FILTERS.map((filter) => {
              const selected = mealFilter === filter.id;
              return (
                <Pressable
                  key={filter.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setMealFilter(filter.id)}
                  style={[styles.mealFilter, selected && styles.mealFilterSelected]}
                >
                  <Text style={[styles.mealFilterText, selected && styles.mealFilterTextSelected]}>{filter.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.mealToolbar}>
            <TextInput
              accessibilityLabel="메뉴 또는 재료 검색"
              value={mealSearch}
              onChangeText={setMealSearch}
              placeholder="메뉴 이름 또는 재료 검색"
              style={styles.mealSearch}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mealBudgetOnly }}
              onPress={() => setMealBudgetOnly((current) => !current)}
              style={[styles.mealBudgetFilter, mealBudgetOnly && styles.mealBudgetFilterSelected]}
            >
              <Text style={[styles.mealBudgetFilterText, mealBudgetOnly && styles.mealBudgetFilterTextSelected]}>
                {mealBudgetOnly ? "✓ " : ""}내 식비 한도 안 메뉴만 보기
              </Text>
            </Pressable>
          </View>
          <View style={styles.mealRows}>
            {visibleMeals.map((item) => {
              const selected = selectedMealIds.includes(item.id);
              const withinBudget = item.price <= mealBudget;
              return (
                <View key={item.id} style={styles.mealRow}>
                  <View style={styles.mealDetails}>
                    <Text style={styles.mealName}>{item.name}</Text>
                    <Text style={styles.mealDescription}>{item.description}</Text>
                  </View>
                  <View style={styles.mealMeta}>
                    <Text style={styles.mealMetaText}>{MEAL_GROUP_LABELS[item.group]}</Text>
                    <Text style={[styles.mealFitText, !withinBudget && styles.mealFitTextOver]}>
                      {withinBudget ? "오늘 식비 내 가능" : "오늘 식비 초과"}
                    </Text>
                  </View>
                  <Text style={styles.mealPrice}>{won(item.price)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${item.name} ${selected ? "식단에서 빼기" : "식단에 담기"}`}
                    onPress={() => toggleMeal(item.id)}
                    style={[styles.mealAddButton, selected && styles.mealAddButtonSelected]}
                  >
                    <Text style={[styles.mealAddText, selected && styles.mealAddTextSelected]}>{selected ? "담김 · 빼기" : "＋ 식단에 담기"}</Text>
                  </Pressable>
                </View>
              );
            })}
            {visibleMeals.length === 0 ? <Text style={styles.mealEmpty}>조건에 맞는 메뉴가 없어요. 검색어나 예산 필터를 바꿔보세요.</Text> : null}
          </View>
          <Text style={styles.mealFootnote}>메뉴와 가격은 참고용이에요. 실제 가격은 매장마다 다를 수 있어요.</Text>
        </View>

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
            <Text style={styles.statLabel}>외출 1일 교통 한도</Text>
            <Text style={styles.statValue}>{summary.transportPerOutingDay === null ? "외출일 없음" : won(summary.transportPerOutingDay)}</Text>
            <Text style={styles.statSub}>예상 외출일 {summary.expectedOutingDays}일</Text>
          </View>
        </View>

        {summary.overBudget > 0 ? (
          <View style={styles.overBudget}><Text style={styles.overBudgetTitle}>플랜 예산을 {won(summary.overBudget)} 초과했어요.</Text><Text style={styles.overBudgetText}>남은 {summary.remainingDays}일 동안 하루 {won(summary.extraDailySavings)}씩 더 절약해야 해요.</Text></View>
        ) : summary.extraDailySavings > 0 ? (
          <View style={styles.savings}><Text style={styles.savingsText}>남은 {summary.remainingDays}일 동안 하루 {won(summary.extraDailySavings)}씩 더 절약하면 계획에 맞출 수 있어요.</Text></View>
        ) : null}

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>항목별 예산</Text><Text style={styles.sectionCaption}>입력한 비율을 반영했어요</Text></View>
        <View style={styles.categoryGrid}>
          {categoryOrder.map((category) => (
            <View key={category} style={styles.categoryCard}>
              <View style={styles.categoryTop}>
                <Text style={styles.categoryName}>{CATEGORY_LABELS[category]}</Text>
                <Text style={styles.categoryRank}>{plan.input.priorities[category]}% 배정</Text>
              </View>
              <View style={styles.categoryLine}><Text style={styles.categoryLabel}>플랜 금액</Text><Text style={styles.categoryAmount}>{won(summary.categoryAmounts[category])}</Text></View>
              <View style={styles.categoryLine}><Text style={styles.categoryLabel}>실제 지출</Text><Text style={styles.categoryAmount}>{won(summary.spentByCategory[category])}</Text></View>
              <View style={styles.categoryDailyBox}><Text style={styles.dailyLabel}>남은 기간 하루 한도</Text><Text style={styles.dailyAmount}>{won(summary.categoryDaily[category])}</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.infoLine}><Text style={styles.infoDot}>i</Text><Text style={styles.infoText}>외출일은 주당 평균으로 추정해요. 실제 요일이나 공휴일 일정은 반영하지 않아요.</Text></View>

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

export function generateMetadata(): Metadata {
  return {
    title: "생활비 플랜 | Daily Runway",
    description: "저장한 생활비 플랜과 실제 지출을 확인해요.",
    robots: { index: false, follow: false },
  };
}

function DailyBudgetCard({
  card,
  selected,
  isToday,
  onPress,
}: {
  card: DailyPlanCard;
  selected: boolean;
  isToday: boolean;
  onPress: () => void;
}) {
  const weekday = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" })
    .format(new Date(`${card.date}T12:00:00+09:00`));
  const balance = `${card.remainingBalance < 0 ? "−" : ""}${Math.abs(card.remainingBalance).toLocaleString("ko-KR")}원`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.date} 예산 카드`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.dateCard, selected && styles.dateCardSelected]}
    >
      <View style={styles.dateCardHeader}>
        <View>
          <Text style={styles.dateCardDate}>{cardDateLabel(card.date)} · {weekday}</Text>
          {isToday ? <Text style={styles.todayTag}>오늘</Text> : null}
        </View>
        {selected ? <Text style={styles.selectedTag}>선택됨</Text> : null}
      </View>
      <View style={styles.dateCategoryList}>
        {CATEGORIES.map((category) => (
          <View key={category} style={styles.dateCategoryRow}>
            <Text style={styles.dateCategoryName}>{CATEGORY_LABELS[category]}</Text>
            <View style={styles.dateAmounts}>
              <Text style={styles.dateAmount}><Text style={styles.dateAmountLabel}>가용 </Text>{won(card.availableByCategory[category])}</Text>
              <Text style={styles.dateAmount}><Text style={styles.dateAmountLabel}>남음 </Text>{won(card.remainingByCategory[category])}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.fixedDueRow}>
        <Text style={styles.fixedDueLabel}>오늘 고정지출</Text>
        <Text style={styles.fixedDueAmount}>{card.fixedExpenseDue > 0 ? won(card.fixedExpenseDue) : "없음"}</Text>
      </View>
      <View style={styles.dateBalanceBox}>
        <Text style={styles.dateBalanceLabel}>누적 예산 반영 후 잔액</Text>
        <Text style={styles.dateBalanceAmount}>{balance}</Text>
      </View>
    </Pressable>
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
  dateSection: { marginBottom: 30 },
  dateSectionCaption: { color: colors.muted, fontSize: 11, marginTop: 5 },
  dateOutsideNote: { color: "#826b3b", fontSize: 10, fontWeight: "700" },
  dateCardsRow: { gap: 10, paddingVertical: 4, paddingHorizontal: 1 },
  dateCard: { width: 290, minHeight: 250, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16 },
  dateCardSelected: { borderColor: colors.accent, borderWidth: 2, backgroundColor: "#fbfcfa" },
  dateCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", minHeight: 40, marginBottom: 10 },
  dateCardDate: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  todayTag: { color: colors.accent, fontSize: 10, fontWeight: "700", marginTop: 3 },
  selectedTag: { color: colors.accent, fontSize: 10, fontWeight: "700" },
  dateCategoryList: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 3 },
  dateCategoryRow: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#f0eee8", gap: 6 },
  dateCategoryName: { color: colors.ink, fontSize: 11, fontWeight: "600", width: 48 },
  dateAmounts: { flex: 1, flexDirection: "row", justifyContent: "space-between", gap: 6 },
  dateAmount: { color: colors.ink, fontSize: 10, fontWeight: "600" },
  dateAmountLabel: { color: colors.muted, fontWeight: "400" },
  fixedDueRow: { minHeight: 36, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  fixedDueLabel: { color: colors.muted, fontSize: 11 },
  fixedDueAmount: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  dateBalanceBox: { backgroundColor: colors.ink, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  dateBalanceLabel: { color: "#d2d4cf", fontSize: 10, flexShrink: 1 },
  dateBalanceAmount: { color: "#fff", fontSize: 13, fontWeight: "700" },
  dateRangeHint: { color: colors.muted, fontSize: 11, marginTop: 6 },
  mealPanel: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 18, marginBottom: 30 },
  mealSummary: { backgroundColor: "#f0f3fc", borderRadius: 12, padding: 16, marginBottom: 14 },
  mealEyebrow: { color: "#4d70c8", fontSize: 11, fontWeight: "700", marginBottom: 8 },
  mealSummaryLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  mealSummaryText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  mealBudgetText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  mealStatus: { color: colors.accent, fontSize: 11, marginTop: 7 },
  mealStatusOver: { color: colors.error, fontWeight: "700" },
  mealIntro: { color: colors.muted, fontSize: 11, lineHeight: 17, marginBottom: 14 },
  mealFilters: { gap: 8, paddingVertical: 3, paddingBottom: 12 },
  mealFilter: { minHeight: 36, borderRadius: 20, borderWidth: 1, borderColor: "#ffc0b4", justifyContent: "center", paddingHorizontal: 14 },
  mealFilterSelected: { backgroundColor: "#ff765e", borderColor: "#ff765e" },
  mealFilterText: { color: colors.ink, fontSize: 11, fontWeight: "600" },
  mealFilterTextSelected: { color: "#fff" },
  mealToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", borderBottomWidth: 1, borderColor: colors.line, paddingBottom: 12 },
  mealSearch: { height: 42, flexGrow: 1, flexBasis: 220, borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 12, color: colors.ink, fontSize: 12 },
  mealBudgetFilter: { minHeight: 40, justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 22, paddingHorizontal: 13 },
  mealBudgetFilterSelected: { borderColor: colors.accent, backgroundColor: colors.pale },
  mealBudgetFilterText: { color: colors.ink, fontSize: 11 },
  mealBudgetFilterTextSelected: { color: colors.accent, fontWeight: "700" },
  mealRows: { marginTop: 2 },
  mealRow: { minHeight: 70, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, borderBottomWidth: 1, borderColor: "#e9e7e1", paddingVertical: 11 },
  mealDetails: { flexGrow: 1, flexBasis: 190 },
  mealMeta: { flexBasis: 120 },
  mealMetaText: { color: colors.muted, fontSize: 10 },
  mealFitText: { color: colors.accent, fontSize: 10, marginTop: 5 },
  mealFitTextOver: { color: colors.error },
  mealName: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  mealDescription: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  mealPrice: { color: colors.ink, fontSize: 13, fontWeight: "600", minWidth: 72, textAlign: "right" },
  mealAddButton: { minHeight: 38, borderWidth: 1, borderColor: "#dedbd4", borderRadius: 20, justifyContent: "center", alignItems: "center", paddingHorizontal: 12 },
  mealAddButtonSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  mealAddText: { color: colors.ink, fontSize: 10, fontWeight: "600" },
  mealAddTextSelected: { color: "#fff" },
  mealEmpty: { color: colors.muted, fontSize: 12, textAlign: "center", paddingVertical: 24 },
  mealFootnote: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 12 },
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
