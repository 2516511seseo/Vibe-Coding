import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { DateField } from "../components/DateField";
import { DEFAULT_PRIORITIES, normalizeForm, seoulToday, swapPriority, validateForm } from "../lib/budget";
import { loadActivePlan } from "../lib/storage";
import { CATEGORIES, CATEGORY_LABELS, type Category, type FormValues, type Priorities, type SavedPlan } from "../lib/types";

const colors = { ink: "#22231f", muted: "#777970", line: "#e6e3dc", paper: "#fff", accent: "#526c5d", pale: "#eaf0e8", error: "#a83d36" };
const ratio = (rank: number) => (rank === 1 ? "50%" : rank === 2 ? "30%" : "20%");

function dateAfter(days: number) {
  const [year, month, day] = seoulToday().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export default function InputScreen() {
  const router = useRouter();
  const today = seoulToday();
  const [values, setValues] = useState<FormValues>({ amount: "", endDate: "", schoolDaysPerWeek: "" });
  const [priorities, setPriorities] = useState<Priorities>(DEFAULT_PRIORITIES);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues | "priorities", string>>>({});
  const [savedPlan, setSavedPlan] = useState<SavedPlan | null>(null);

  useEffect(() => { loadActivePlan().then(setSavedPlan); }, []);

  function update(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function calculate() {
    const nextErrors = validateForm(values, priorities, today);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const draft = {
      id: `draft-${Date.now()}`,
      createdAt: new Date().toISOString(),
      startDate: today,
      input: normalizeForm(values, priorities),
      expenses: [],
    };
    router.push({ pathname: "/plan", params: { draft: JSON.stringify(draft) } });
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <View style={styles.topline}>
          <Text style={styles.brand}>DAILY RUNWAY</Text>
          <Text style={styles.topNote}>매일의 지출 계획</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>대학생 생활비 계산기</Text>
          <Text style={styles.title}>다음 용돈일까지,{"\n"}하루 얼마씩 쓸까?</Text>
          <Text style={styles.description}>남은 생활비와 등교 일정을 기준으로 식비·교통비·여가비 계획을 세워요.</Text>
        </View>

        {savedPlan ? (
          <Pressable accessibilityRole="button" onPress={() => router.push("/plan")} style={styles.resumeCard}>
            <View>
              <Text style={styles.resumeEyebrow}>저장된 플랜</Text>
              <Text style={styles.resumeText}>이어서 지출을 기록해요</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </Pressable>
        ) : null}

        <View style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>새 생활비 플랜</Text>
            <Text style={styles.step}>01 / 02</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>세 항목에 나눌 생활비</Text>
            <Text style={styles.hint}>월세·통신비 등 다른 용도로 나갈 돈은 제외해 주세요.</Text>
            <View style={styles.amountBox}>
              <TextInput
                accessibilityLabel="세 항목에 나눌 생활비"
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
            <Text style={styles.label}>이 돈을 언제까지 쓸 건가요?</Text>
            <Text style={styles.hint}>다음 수입일이 12월 4일이면, 그 전날을 선택하세요.</Text>
            <DateField accessibilityLabel="생활비 종료일" value={values.endDate} onChange={(value) => update("endDate", value)} min={today} max={dateAfter(365)} />
            {errors.endDate ? <Text accessibilityRole="alert" style={styles.error}>{errors.endDate}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>주당 등교일수</Text>
            <Text style={styles.hint}>실제 요일이나 공휴일이 아닌 주간 평균으로 계산해요.</Text>
            <View style={styles.schoolRow}>
              <TextInput
                accessibilityLabel="주당 등교일수"
                value={values.schoolDaysPerWeek}
                onChangeText={(value) => update("schoolDaysPerWeek", value)}
                placeholder="예: 5"
                keyboardType="number-pad"
                style={styles.schoolInput}
              />
              <Text style={styles.unit}>일 / 주</Text>
            </View>
            {errors.schoolDaysPerWeek ? <Text accessibilityRole="alert" style={styles.error}>{errors.schoolDaysPerWeek}</Text> : null}
          </View>

          <View style={[styles.field, styles.priorityField]}>
            <View style={styles.priorityHeading}>
              <Text style={styles.label}>지출 우선순위</Text>
              <Text style={styles.hint}>1위 50% · 2위 30% · 3위 20%</Text>
            </View>
            {CATEGORIES.map((category) => (
              <View key={category} style={styles.priorityRow}>
                <Text style={styles.categoryName}>{CATEGORY_LABELS[category]}</Text>
                <View style={styles.rankChoices}>
                  {([1, 2, 3] as const).map((rank) => {
                    const selected = priorities[category] === rank;
                    return (
                      <Pressable
                        key={rank}
                        accessibilityRole="button"
                        accessibilityLabel={`${CATEGORY_LABELS[category]} ${rank}위, ${ratio(rank)}`}
                        accessibilityState={{ selected }}
                        onPress={() => setPriorities((current) => swapPriority(current, category, rank))}
                        style={[styles.rankButton, selected && styles.rankButtonSelected]}
                      >
                        <Text style={[styles.rankText, selected && styles.rankTextSelected]}>{rank}위</Text>
                        <Text style={[styles.rankRatio, selected && styles.rankTextSelected]}>{ratio(rank)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {errors.priorities ? <Text accessibilityRole="alert" style={styles.error}>{errors.priorities}</Text> : null}
          </View>

          <Pressable accessibilityRole="button" onPress={calculate} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>생활비 플랜 계산하기</Text>
            <Text style={styles.buttonArrow}>→</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>50·30·20 비율은 권장 예산이며, 필수 비용 충족을 보장하지 않아요.</Text>
      </View>
    </ScrollView>
  );
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
  priorityHeading: { marginBottom: 8 },
  priorityRow: { minHeight: 62, borderTopWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  categoryName: { color: colors.ink, fontWeight: "600", fontSize: 14 },
  rankChoices: { flexDirection: "row", gap: 8 },
  rankButton: { width: 54, minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rankButtonSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  rankText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  rankRatio: { color: colors.muted, fontSize: 10, marginTop: 2 },
  rankTextSelected: { color: "#fff" },
  primaryButton: { height: 60, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.ink, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  buttonArrow: { color: "#fff", fontSize: 20 },
  footer: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 18 },
});
