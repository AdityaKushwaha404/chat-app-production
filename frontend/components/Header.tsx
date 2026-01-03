import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import Typo from "@/components/Typo";
import { colors, spacingX } from "@/constants/theme";

export default function Header({ title, left, right }: any) {
  return (
    <View style={styles.container}>
      <View style={styles.side}>{left}</View>
      <View style={styles.center}>
        <Typo size={18} color={colors.white} fontWeight="800">
          {title}
        </Typo>
      </View>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacingX._20,
    paddingVertical: 8,
  },
  side: { width: 44, alignItems: "center" },
  center: { flex: 1, alignItems: "center" },
});
