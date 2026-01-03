import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { AvatarProps } from "@/types";
import { colors } from "@/constants/theme";

const Avatar = ({ uri, size = 60, style }: AvatarProps & { size?: number }) => {
  const src = typeof uri === "string" && uri.length > 0 ? { uri } : require("@/assets/images/defaultAvatar.png");

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Image source={src} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
    </View>
  );
};

export default Avatar;

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: colors.neutral300,
  },
});
