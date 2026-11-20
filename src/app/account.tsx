import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { createPlanAccount, loadPendingPlan, restorePlanAccount } from "../lib/storage";
import { colors } from "../lib/theme";
import type { SavedPlan } from "../lib/types";

export default function AccountScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const creating = mode === "create";
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [pendingPlan, setPendingPlan] = useState<SavedPlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (creating) loadPendingPlan().then(setPendingPlan); }, [creating]);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      if (creating) {
        if (!pendingPlan) throw new Error("저장할 플랜을 찾지 못했어요. 계산 화면으로 돌아가 다시 시도해 주세요.");
        await createPlanAccount(nickname, pin, pendingPlan);
      } else {
        await restorePlanAccount(nickname, pin);
      }
      router.replace("/plan");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "처리하지 못했어요. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>← 돌아가기</Text></Pressable>
        <Text style={styles.brand}>DAILY RUNWAY</Text>
        <Text style={styles.title}>{creating ? "플랜을 저장할게요" : "저장된 플랜을 불러와요"}</Text>
        <Text style={styles.copy}>{creating ? "닉네임과 숫자 4자리 비밀번호를 만들어요." : "저장할 때 만든 닉네임과 숫자 4자리를 입력해 주세요."}</Text>
        <Text style={styles.label}>닉네임</Text>
        <TextInput accessibilityLabel="닉네임" value={nickname} onChangeText={setNickname} placeholder="닉네임" maxLength={24} autoCapitalize="none" style={styles.input} />
        <Text style={styles.label}>숫자 4자리 비밀번호</Text>
        <TextInput accessibilityLabel="숫자 4자리 비밀번호" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" keyboardType="number-pad" secureTextEntry maxLength={4} style={styles.input} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={[styles.button, busy && styles.disabled]}>
          <Text style={styles.buttonText}>{busy ? "잠시만요…" : creating ? "닉네임과 비밀번호 만들고 저장" : "플랜 불러오기"}</Text>
        </Pressable>
        <Text style={styles.note}>플랜과 지출은 이 브라우저에만 저장돼요. 브라우저 데이터를 지우거나 다른 기기를 쓰면 불러올 수 없어요.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f7f6f2" },
  pageContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 500, alignSelf: "center", padding: 28, borderRadius: 20, backgroundColor: "white", borderWidth: 1, borderColor: colors.line },
  back: { color: colors.accent, fontSize: 14, marginBottom: 28 },
  brand: { color: colors.accent, fontSize: 12, letterSpacing: 2, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 28, fontWeight: "700", marginTop: 14 },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 26 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  input: { height: 52, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingHorizontal: 14, fontSize: 16, color: colors.ink },
  error: { color: colors.error, fontSize: 13, lineHeight: 19, marginTop: 12 },
  button: { height: 54, backgroundColor: colors.accent, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 24 },
  disabled: { opacity: 0.6 },
  buttonText: { color: "white", fontSize: 15, fontWeight: "700" },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 18 },
});
