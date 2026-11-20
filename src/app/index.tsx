import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { DateField } from "../components/DateField";
import { DEFAULT_PRIORITIES, normalizeForm, seoulToday, setPriorityPercent, validateForm } from "../lib/budget";
import { getSiteOrigin } from "../lib/seo";
import { CATEGORIES, CATEGORY_LABELS, type Category, type FixedExpenseDraft, type FormValues, type Priorities } from "../lib/types";
import type { Metadata } from "expo-router/server";

const colors = { ink: "#22231f", muted: "#777970", line: "#e6e3dc", paper: "#fff", accent: "#526c5d", pale: "#eaf0e8", error: "#a83d36" };

function dateAfter(days: number) {
  const [year, month, day] = seoulToday().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export default function InputScreen() {
  const router = useRouter();
  const today = seoulToday();
  const [values, setValues] = useState<FormValues>({ amount: "", endDate: "", outingDaysPerWeek: "" });
  const [priorities, setPriorities] = useState<Priorities>(DEFAULT_PRIORITIES);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues | "priorities" | "fixedExpenses", string>>>({});
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpenseDraft[]>([]);

  function update(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function calculate() {
    const nextErrors = validateForm(values, priorities, today, fixedExpenses);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const draft = {
      id: `draft-${Date.now()}`,
      createdAt: new Date().toISOString(),
      startDate: today,
      input: normalizeForm(values, priorities, fixedExpenses),
      expenses: [],
    };
    router.push({ pathname: "/plan", params: { draft: JSON.stringify(draft) } });
  }

  function addFixedExpense() {
    const item: FixedExpenseDraft = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, amount: "", transferDate: today };
    setFixedExpenses((items) => [...items, item]);
    setErrors((current) => ({ ...current, fixedExpenses: undefined }));
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <View style={styles.topline}>
          <Text style={styles.brand}>DAILY RUNWAY</Text>
          <Text style={styles.topNote}>매일의 지출 계획</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>생활비 계산기</Text>
          <Text style={styles.title}>돈 없어 미치겠다!!!{"\n"}어떻게 버텨야 하지?</Text>
          <Text style={styles.description}>남은 생활비를 기준으로 식비·교통비·여가비 계획을 세워요.</Text>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/account", params: { mode: "restore" } })} style={styles.resumeCard}>
          <View><Text style={styles.resumeEyebrow}>저장된 플랜</Text><Text style={styles.resumeText}>닉네임과 비밀번호로 불러와요</Text></View>
          <Text style={styles.arrow}>→</Text>
        </Pressable>

        <View style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>새 생활비 플랜</Text>
            <Text style={styles.step}>01 / 02</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>고정지출을 포함한 전체 생활비</Text>
            <Text style={styles.hint}>고정지출을 입력하면 그 금액을 먼저 제외하고 식비·교통비·여가비를 계산해요.</Text>
            <View style={styles.amountBox}>
              <TextInput
                accessibilityLabel="고정지출을 포함한 전체 생활비"
                value={values.amount}
                onChangeText={(value) => update("amount", value)}
                placeholder="금액 입력"
                keyboardType="number-pad"
                style={styles.amountInput}
              />
              <Text style={styles.unit}>원</Text>
            </View>
            {errors.amount ? <Text accessibilityRole="alert" style={styles.error}>{errors.amount}</Text> : null}
          </View>

          <View style={styles.field}>
            <View style={styles.fixedHeading}>
              <View style={styles.fixedHeadingText}>
                <Text style={styles.label}>고정지출</Text>
                <Text style={styles.hint}>플랜 기간에 이체할 금액과 날짜를 입력해 주세요.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={addFixedExpense}
                style={styles.addFixedButton}
              >
                <Text style={styles.addFixedText}>＋ 추가</Text>
              </Pressable>
            </View>
            {fixedExpenses.map((item, index) => (
              <View key={item.id} style={styles.fixedExpenseRow}>
                <Text style={styles.fixedIndex}>고정지출 {index + 1}</Text>
                <View style={styles.fixedAmountBox}>
                  <TextInput
                    accessibilityLabel={`고정지출 ${index + 1} 금액`}
                    value={item.amount}
                    onChangeText={(amount) => setFixedExpenses((items) => items.map((current) => current.id === item.id ? { ...current, amount } : current))}
                    placeholder="금액"
                    keyboardType="number-pad"
                    style={styles.fixedAmountInput}
                  />
                  <Text style={styles.unit}>원</Text>
                </View>
                <DateField
                  accessibilityLabel={`고정지출 ${index + 1} 이체일`}
                  value={item.transferDate}
                  onChange={(transferDate) => setFixedExpenses((items) => items.map((current) => current.id === item.id ? { ...current, transferDate } : current))}
                  min={today}
                  max={values.endDate || dateAfter(365)}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`고정지출 ${index + 1} 삭제`}
                  onPress={() => setFixedExpenses((items) => items.filter((current) => current.id !== item.id))}
                  style={styles.removeFixedButton}
                >
                  <Text style={styles.removeFixedText}>삭제</Text>
                </Pressable>
              </View>
            ))}
            {errors.fixedExpenses ? <Text accessibilityRole="alert" style={styles.error}>{errors.fixedExpenses}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>이 돈을 언제까지 쓸 건가요?</Text>
            <Text style={styles.hint}>다음 수입일이 12월 4일이면, 그 전날을 선택하세요.</Text>
            <DateField accessibilityLabel="생활비 종료일" value={values.endDate} onChange={(value) => update("endDate", value)} min={today} max={dateAfter(365)} />
            {errors.endDate ? <Text accessibilityRole="alert" style={styles.error}>{errors.endDate}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>주당 외출일수</Text>
            <Text style={styles.hint}>1~7일 사이에서 골라 주세요. 학교·아르바이트·약속 등을 포함한 주간 평균이에요.</Text>
            <View style={styles.schoolRow}>
              <TextInput
                accessibilityLabel="주당 외출일수"
                value={values.outingDaysPerWeek}
                onChangeText={(value) => update("outingDaysPerWeek", value.replace(/\D/g, "").slice(0, 1))}
                placeholder="예: 5일"
                keyboardType="number-pad"
                maxLength={1}
                style={styles.schoolInput}
              />
              <Text style={styles.unit}>일 / 주</Text>
            </View>
            {errors.outingDaysPerWeek ? <Text accessibilityRole="alert" style={styles.error}>{errors.outingDaysPerWeek}</Text> : null}
          </View>

          <View style={[styles.field, styles.priorityField]}>
            <View style={styles.priorityHeading}>
              <Text style={styles.label}>분야별 예산 비율</Text>
              <Text style={styles.hint}>슬라이더를 움직여 조절해요. 비율은 0%까지 낮출 수 있고, 합계는 항상 100%예요.</Text>
            </View>
            {CATEGORIES.map((category) => (
              <View key={category} style={styles.priorityRow}>
                <View style={styles.priorityRowTop}>
                  <View>
                    <Text style={styles.categoryName}>{CATEGORY_LABELS[category]}</Text>
                    <Text style={styles.priorityRank}>{priorities[category] === 0 ? "배정 없음" : `${[...CATEGORIES].sort((a, b) => priorities[b] - priorities[a]).indexOf(category) + 1}순위`}</Text>
                  </View>
                  <Text style={styles.priorityPercent}>{priorities[category]}%</Text>
                </View>
                <Slider
                  accessibilityLabel={`${CATEGORY_LABELS[category]} 예산 비율`}
                  minimumValue={0}
                  maximumValue={100}
                  step={1}
                  value={priorities[category]}
                  onValueChange={(value) => setPriorities((current) => setPriorityPercent(current, category, value))}
                  minimumTrackTintColor={colors.accent}
                  maximumTrackTintColor="#dfe5dc"
                  thumbTintColor={colors.accent}
                  style={styles.allocationSlider}
                />
              </View>
            ))}
            {errors.priorities ? <Text accessibilityRole="alert" style={styles.error}>{errors.priorities}</Text> : null}
          </View>

          <Pressable accessibilityRole="button" onPress={calculate} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>생활비 플랜 계산하기</Text>
            <Text style={styles.buttonArrow}>→</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>한 분야의 비율을 바꾸면 나머지 분야가 자동 조정돼 합계 100%를 유지해요. 0%로도 설정할 수 있어요.</Text>
      </View>
    </ScrollView>
  );
}

export function generateMetadata(): Metadata {
  const title = "생활비 계산기 | DAILY RUNWAY";
  const description = "남은 생활비를 기준으로 식비·교통비·여가비 플랜을 세워요.";
  const canonical = `${getSiteOrigin()}/`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", locale: "ko_KR", url: canonical, title, description, siteName: "Daily Runway" },
  };
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f7f6f2" },
  pageContent: { paddingHorizontal: 20, paddingBottom: 56 },
  container: { width: "100%", maxWidth: 820, alignSelf: "center" },
  topline: { height: 76, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: colors.line },
  brand: { color: colors.ink, fontSize: 13, letterSpacing: 2.4, fontWeight: "800" },
  topNote: { color: colors.muted, fontSize: 12 },
  hero: { paddingTop: 50, paddingBottom: 28 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, marginBottom: 14 },
  title: { color: colors.ink, fontSize: 40, lineHeight: 48, letterSpacing: -1.5, fontWeight: "700" },
  description: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 16, maxWidth: 520 },
  resumeCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.pale, padding: 20, borderRadius: 16, marginBottom: 18 },
  resumeEyebrow: { color: colors.accent, fontWeight: "700", fontSize: 12, marginBottom: 5 },
  resumeText: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  arrow: { color: colors.accent, fontSize: 24 },
  formCard: { backgroundColor: colors.paper, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 28 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 26, paddingBottom: 18, borderBottomWidth: 1, borderColor: colors.line },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  step: { color: colors.muted, fontSize: 11, letterSpacing: 1.1 },
  field: { marginBottom: 24 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 10 },
  amountBox: { flexDirection: "row", height: 60, borderWidth: 1, borderColor: colors.line, borderRadius: 12, alignItems: "center", paddingHorizontal: 16, backgroundColor: "#fff" },
  amountInput: { flex: 1, fontSize: 21, color: colors.ink, height: "100%" },
  unit: { color: colors.muted, fontSize: 14 },
  schoolRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 12, height: 52, paddingHorizontal: 14 },
  schoolInput: { flex: 1, fontSize: 16, color: colors.ink, height: "100%" },
  error: { color: colors.error, fontSize: 12, marginTop: 7 },
  priorityField: { marginBottom: 28 },
  fixedHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  fixedHeadingText: { flex: 1 },
  addFixedButton: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.pale },
  addFixedText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  fixedExpenseRow: { backgroundColor: "#f7f6f2", borderRadius: 12, padding: 12, marginTop: 10 },
  fixedIndex: { color: colors.ink, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  fixedAmountBox: { flexDirection: "row", height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 10, alignItems: "center", paddingHorizontal: 12, backgroundColor: "#fff", marginBottom: 8 },
  fixedAmountInput: { flex: 1, fontSize: 15, color: colors.ink, height: "100%" },
  removeFixedButton: { alignSelf: "flex-end", paddingHorizontal: 8, paddingVertical: 7 },
  removeFixedText: { color: colors.muted, fontSize: 11 },
  priorityHeading: { marginBottom: 8 },
  priorityRow: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 12, paddingBottom: 6 },
  priorityRowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  categoryName: { color: colors.ink, fontWeight: "600", fontSize: 14 },
  priorityRank: { color: colors.muted, fontSize: 10, marginTop: 4 },
  priorityPercent: { color: colors.accent, fontSize: 16, fontWeight: "700" },
  allocationSlider: { width: "100%", height: 38, marginTop: 4 },
  primaryButton: { height: 60, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.ink, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  buttonArrow: { color: "#fff", fontSize: 20 },
  footer: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 18 },
});
