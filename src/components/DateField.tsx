import React from "react";
import { Platform, TextInput, View } from "react-native";

type Props = {
  value: string;
  onChange: (value: string) => void;
  min: string;
  max: string;
  accessibilityLabel: string;
};

export function DateField({ value, onChange, min, max, accessibilityLabel }: Props) {
  if (Platform.OS === "web") {
    return (
      <View style={{ width: "100%", minWidth: 0, maxWidth: "100%" }}>
        {React.createElement("input", {
          type: "date",
          value,
          min,
          max,
          "aria-label": accessibilityLabel,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
          style: {
            boxSizing: "border-box",
            display: "block",
            height: 52,
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
            flexShrink: 1,
            border: "1px solid #dedbd4",
            borderRadius: 12,
            background: "#fff",
            padding: "0 14px",
            color: "#22231f",
            fontSize: 16,
            fontFamily: "inherit",
          },
        })}
      </View>
    );
  }

  return (
    <View style={{ width: "100%", minWidth: 0, maxWidth: "100%", borderWidth: 1, borderColor: "#dedbd4", borderRadius: 12, backgroundColor: "#fff" }}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        style={{ width: "100%", minWidth: 0, height: 52, paddingHorizontal: 14, fontSize: 16, color: "#22231f" }}
      />
    </View>
  );
}
