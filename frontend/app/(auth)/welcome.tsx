import { Pressable, StyleSheet, View } from "react-native";
import React from "react";
import ScreenWrapper from "../../components/ScreenWrapper";
import Typo from "../../components/Typo";
import { colors } from "@/constants/theme";
import Button from "@/components/Button";
import Animated, { FadeIn } from "react-native-reanimated";
import { Link, useRouter } from "expo-router";

const Welcome = () => {
  const router = useRouter();

  return (
    <ScreenWrapper showPattern={true} bgOpacity={0.5}>
      <View style={styles.container}>
        <Typo color={colors.white} size={48} fontWeight={"800"} style={styles.title}>
          Bubbly
        </Typo>

        <Animated.Image
          entering={FadeIn.duration(700).springify()}
          source={require("../../assets/images/welcome.png")}
          style={styles.welcomeImage}
          resizeMode="contain"
        />

        <View style={styles.copyWrapper}>
          <Typo color={colors.white} size={33} fontWeight={"800"} style={{ lineHeight: 44 }}>
            Stay Connected
          </Typo>
          <Typo color={colors.white} size={33} fontWeight={"800"} style={{ lineHeight: 44 }}>
            with your friends
          </Typo>
          <Typo color={colors.white} size={33} fontWeight={"800"} style={{ lineHeight: 44 }}>
            and family
          </Typo>
        </View>

        <Button
          style={styles.getStartedButton}
          onPress={() => router.push("/(auth)/register")}
        >
          <Typo size={20} fontWeight={"700"} color={colors.text}>
            Get Started
          </Typo>
        </Button>

        <View style={styles.footerRow}>
          <Typo size={15} color={colors.neutral300}>
            Already have an account?{" "}
          </Typo>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Typo size={15} fontWeight={"800"} color={colors.primary}>
                Login
              </Typo>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default Welcome;

const styles = StyleSheet.create({
  welcomeImage: {
    width: "100%",
    height: 320,
    marginBottom: 20,
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  title: {
    marginTop: 8,
    alignSelf: "center",
  },
  copyWrapper: {
    width: "100%",
    paddingHorizontal: 8,
    alignItems: "flex-start",
  },
  getStartedButton: {
    backgroundColor: colors.white,
    width: "92%",
    alignSelf: "center",
    paddingHorizontal: 10,
  },
  footerRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});
