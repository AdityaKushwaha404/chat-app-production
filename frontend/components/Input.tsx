import { colors, radius, spacingX } from "@/constants/theme";
import { InputProps } from "@/types";
import { verticalScale } from "@/utils/styling";
import React from "react";
import { StyleSheet, TextInput, View } from "react-native";

const Input = ({
  icon,
  containerStyle,
  inputStyle,
  inputRef,
  ...props
}: InputProps) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <TextInput
        ref={inputRef}
        placeholderTextColor={colors.neutral400}
        style={[styles.input, inputStyle]}
        {...props}
      />
    </View>
  );
};

export default Input;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral100,
    borderRadius: radius.full,
    borderCurve: "continuous",
    height: verticalScale(56),
    paddingHorizontal: spacingX._15,
  },
  icon: {
    width: verticalScale(22),
    marginRight: spacingX._10,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: verticalScale(15),
  },
});
