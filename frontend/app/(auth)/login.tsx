import Button from "@/components/Button";
import Input from "@/components/Input";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingY } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/authContext";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

const Login = () => {
  const router = useRouter();
  const auth = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length >= 6;
  }, [email, password]);

  const onSubmit = () => {
    if (!canSubmit) {
      Alert.alert("Missing info", "Please enter email and password (min 6 chars).");
      return;
    }

    // call auth context signIn
    (async () => {
      try {
        await auth.signIn(email, password);
      } catch (e: any) {
        Alert.alert("Login failed", e.message || "Unable to login");
      }
    })();
  };

  return (
    <ScreenWrapper showPattern={true} bgOpacity={0.5}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.white} />
          </Pressable>
          <Typo color={colors.neutral300} size={15} fontWeight="600">
            Need some help?
          </Typo>
        </View>

        <View style={styles.card}>
          <Typo size={30} fontWeight="800" color={colors.text}>
            Welcome Back
          </Typo>
          <Typo size={15} color={colors.neutral600} style={{ marginTop: 6 }}>
            Login to continue
          </Typo>

          <View style={{ marginTop: spacingY._25 }}>
            <Input
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              icon={<Ionicons name="at-outline" size={20} color={colors.neutral600} />}
            />

            <View style={{ height: spacingY._15 }} />

            <View style={styles.passwordRow}>
              <Input
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                secureTextEntry={!showPassword}
                returnKeyType="done"
                icon={<Ionicons name="lock-closed-outline" size={20} color={colors.neutral600} />}
                containerStyle={{ paddingRight: 44 }}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeBtn}
                hitSlop={10}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.neutral600}
                />
              </Pressable>
            </View>
          </View>

          <Button onPress={onSubmit} style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}>
            <Typo size={20} fontWeight="800" color={colors.text}>
              Login
            </Typo>
          </Button>

          <View style={styles.footerRow}>
            <Typo size={15} color={colors.neutral600}>
              Don’t have an account?{" "}
            </Typo>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <Typo size={15} fontWeight="800" color={colors.primaryDark}>
                  Sign Up
                </Typo>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

export default Login;

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius._40,
    borderTopRightRadius: radius._40,
    borderCurve: "continuous",
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
  },
  passwordRow: {
    width: "100%",
    position: "relative",
  },
  eyeBtn: {
    position: "absolute",
    right: 18,
    top: 18,
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtn: {
    marginTop: spacingY._25,
    backgroundColor: colors.primary,
  },
  submitBtnDisabled: {
    backgroundColor: colors.primaryLight,
  },
  footerRow: {
    marginTop: spacingY._15,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});
